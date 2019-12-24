import { BaseModel } from "../../../interfaces/base-model.interface";
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Storage } from "@ionic/storage";
import { Network } from '@ionic-native/network';
import { Update } from "../../../types/update.type";
import 'rxjs/add/operator/toPromise';

import { BehaviorSubject, Observable, Subscription } from 'rxjs';


export abstract class OfflineService<T extends BaseModel> {

    protected listItems: BehaviorSubject<T[]> = new BehaviorSubject<T[]>([]);
    private headers: HttpHeaders = new HttpHeaders({
        'Content-Type': 'application/json'
    })
    private updates: Update<T>[];
    private lastUpdate: number = 0;
    private syncIntervalId: number;
    private networkOnConnectSubscription: Subscription;
    private networkOnDisconnectSubscription: Subscription;

    constructor(
        private http: HttpClient,
        private itemApiURL: string,
        private network: Network,
        private resourceName: string,
        private storage: Storage
    ) {
        this.init();
    }

    private init(): void {
        this.updates = [];

        this.getItemsFromCache()
            .then(() => this.getAllFromStorage())
            .then((items: T[]) => this.listItems.next(items));

        this.getUpdatesFromStorage()
            .then((updates: Update<T>[]) =>{ 
                this.synchronize();
            });

        this.createInterval();
        this.startNetworkListening();
    }

    private getAllFromStorage(): Promise<T[]> {
        return this.storage.ready()
            .then((localForage: LocalForage) => {

                let items: T[] = [];

                return this.storage.forEach((value: any, key: string, iterationNumber: number) => {
                    if (key.indexOf(`${this.resourceName}.`) > -1 && key.indexOf('updates.') == -1) {
                        items.push(value);
                    }
                }).then(() => {
                    return items;
                });

            });
    }

    private saveInStorage(item: T): Promise<T> {
        return this.storage.set(`${this.resourceName}.${item.id}`, item);
    }

    private deleteFromStorage(item: T): Promise<boolean> {
        return this.storage.remove(`${this.resourceName}.${item.id}`)
            .then(() => true);
    }

    protected getFromStorage(id: number): Promise<T> {
        return this.storage.get(`${this.resourceName}.${id}`);
    }

    private saveAllInStorage(items: T[]): Promise<T[]> {

        let promises: Promise<T>[] = [];

        items.forEach((item: T) => {

            promises.push(this.saveInStorage(item));
        });

        return Promise.all(promises);
    }

    private addUpdate(update: Update<T>): Promise<Update<T>> {

        return this.storage.set(`updates.${this.resourceName}.${update.value.id}`, update)
            .then((up: Update<T>) => {
                this.updates.push(up);
                this.syncPushingToServer();
                return up;

            })
    }

    private startNetworkListening(): void {

        this.networkOnConnectSubscription = this.network.onConnect()
            .subscribe(() => {
                console.info('Network connected!');
                this.createInterval();
                this.synchronize();
            });

        this.networkOnDisconnectSubscription = this.network.onDisconnect()
            .subscribe(() => {
                console.info('Network Disconnected');
                this.deleteInterval();
            });
    }

    public stopNetworkListening(): void {
        this.networkOnConnectSubscription.unsubscribe();
        this.networkOnDisconnectSubscription.unsubscribe();
        this.deleteInterval();
    }

    private removeUpdate(update: Update<T>): Promise<void> {
        return this.storage.remove(`updates.${this.resourceName}.${update.value.id}`)
            .then(() => {
                this.updates.splice(this.updates.indexOf(update), 1);
            })
    }

    private getUpdatesFromStorage(): Promise<Update<T>[]> {
        return this.storage.ready()
            .then((localForage: LocalForage) => {

                return this.storage.forEach((value: any, key: string, iterationNumber: number) => {
                    if (key.indexOf(`updates.${this.resourceName}.`) > -1) {
                        this.updates.push(value);
                    }
                }).then(() => {
                    return this.updates;
                });

            });
    }

    private getItemsFromCache(): Promise<void> {

        if ('caches' in window) {

            return self.caches.match(`${this.itemApiURL}/${this.resourceName}`)
                .then((response) => {
                    if (response) {
                        return response
                            .json()
                            .then(cachedJson => {
                                if (cachedJson.timestamp > this.lastUpdate) {
                                    this.listItems.next(cachedJson.data);
                                    this.setLastUpdate(cachedJson.timestamp);
                                }
                            });
                    }
                });

        } else {
            return Promise.resolve();
        }

    }

    private saveInServer(update: Update<T>): Observable<any> {

        let url: string = `${this.itemApiURL}/${this.resourceName}`;
        let responseObservable: Observable<any>;

        switch (update.method) {
            case 'put':
                url += `/${update.value.id}`;
            case 'post':
                responseObservable = this.http[update.method](url, JSON.stringify(update.value), { headers: this.headers });
                break;
            case 'delete':
                url += `/${update.value.id}`;
                responseObservable = this.http.delete(url, { headers: this.headers })
                break;
        }

        return responseObservable.map((response: any) => response.json())

    }

    protected createInServer(item: T): Promise<T> {

        return this.saveInStorage(item)
            .then((item: T) => {

                this.addUpdate(new Update<T>('post', item))
                    .then((update: Update<T>) => {
                        let items: T[] = this.listItems.getValue();
                        items.push(item);
                        this.listItems.next(items);
                    })

                return item;
            })
    }

    private synchronize(): void {

        this.syncPushingToServer()
            .then((updates: Update<T>[]) => {
                this.syncPullingFromServer();
            });

    }

    private createInterval(): void {
        if (!this.syncIntervalId) {
            this.syncIntervalId = setInterval(() => {
                this.synchronize();
            }, 60000)
        }
    }

    private deleteInterval(): void {
        if (this.syncIntervalId) {
            clearInterval(this.syncIntervalId);
            this.syncIntervalId = undefined;
        }
    }


    protected updateInServer(item: T): Promise<T> {
        item.synchronized = false;
        return this.saveInStorage(item)
            .then((item: T) => {

                this.addUpdate(new Update<T>('put', item));

                return item;
            })

    }

    protected deleteInServer(item: T): Promise<void> {

        return this.deleteFromStorage(item)
            .then((deleted: boolean) => {

                this.addUpdate(new Update('delete', item))
                    .then((up: Update<T>) => {
                        let items: T[] = this.listItems.getValue();
                        items.splice(items.indexOf(item), 1);
                        this.listItems.next(items);
                    });

            });

    }

    private syncPushingToServer(): Promise<Update<T>[]> {
        let promises: Promise<Update<T>>[] = [];

        this.updates.forEach((update: Update<T>) => {

            promises.push(
                <Promise<Update<T>>>this.saveInServer(update)
                    .toPromise()
                    .then((serverData: any) => {

                        this.setLastUpdate(serverData.timestamp);
                        this.removeUpdate(update);
                        if (update.method !== 'delete') {
                            this.setSynchronized(serverData.data.id, true);
                        }

                        return update;

                    }).catch((error: Error) => {
                        console.log('Error Sending Request to Server: ', error);
                    })

            );

        });

        return Promise.all(promises);
    }

    private syncPullingFromServer(): Promise<T[]> {
        return this.http.get(`${this.itemApiURL}/${this.resourceName}`)
                .toPromise()
                .then((serverData: any) => {
                if (serverData.timestamp > this.lastUpdate) {
                    this.setLastUpdate(serverData.timestamp);
                    return this.saveAllInStorage(serverData.data)
                        .then((items: T[]) => {
                            this.listItems.next(items);
                            this.cleanStorage(items);
                            return items;
                        })
                }
            
                return serverData.data;
            }).catch((error: Error) => {
                console.log('Error fetching data to server: ', error);
            })
    }

    private cleanStorage(serverItems: T[]): void {

        if (this.lastUpdate > 0) {

            this.getAllFromStorage()
                .then((storageItems: T[]) => {

                    let itemsToDelete: T[] = storageItems.filter((storageItem: T) => {
                        return !serverItems.some((serverItem: T) => serverItem.id === storageItem.id);
                    });

                    itemsToDelete.forEach((itemToDelete: T) => {
                        this.deleteFromStorage(itemToDelete);
                    });

                });

        }

    }

    private setSynchronized(index: number | string, synchronized: boolean): void {
        let items: T[] = this.listItems.getValue();
        for (let i: number = 0; i < items.length; i++) {
            let item: T = items[i];
            if (item.id === index) {
                item.synchronized = synchronized;

                this.saveInStorage(item)
                    .then(() => {

                        this.listItems.next(items);

                    })
            }
        }
    }

    private setLastUpdate(timestamp: number): void {
        this.lastUpdate = timestamp;
    }

}