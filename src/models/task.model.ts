export class Task {

    public id: number;
    public done: boolean;
    public synchronized: boolean;

    constructor(
        public title: string
    ) {
        this.id = new Date().getTime();
        this.done = false;
        this.synchronized = false;
    }
}