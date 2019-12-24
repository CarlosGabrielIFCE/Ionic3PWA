import { Injectable, Inject } from '@angular/core';
import { Storage } from '@ionic/storage';
import { Task } from '../../models/task.model';
import { TASK_API_URL } from '../../config/task-api-url.injectiontoken';
import { OfflineService } from './offline/offline.service';
import { HttpClient } from '@angular/common/http';
import { Network } from '@ionic-native/network';
import { Observable } from 'rxjs';

@Injectable()
export class TaskService extends OfflineService<Task>{

  public tasks: Observable<Task[]>;

  constructor(
     http: HttpClient,
     network: Network,
     storage: Storage,
    @Inject(TASK_API_URL) taskApiURL: string) {
      super(http, taskApiURL, network, 'tasks', storage);
      this.tasks = this.listItems;
  }


  /**
   * Recebe uma Task específica
   * @param id 
   */
  get(id: number): Promise<Task> {
    return super.getFromStorage(id);
  }

  /**
   * Cria uma Task Nova
   * @param task 
   */
  create(task: Task): Promise<Task> {
    return super.createInServer(task);
  }

  update(task: Task): Promise<Task> {
    return super.updateInServer(task);
  }

  delete(task: Task): Promise<void> {
    return super.deleteInServer(task);
  }
}
