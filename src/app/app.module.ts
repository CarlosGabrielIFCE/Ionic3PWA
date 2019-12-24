import { BrowserModule } from '@angular/platform-browser';
import { ErrorHandler, NgModule } from '@angular/core';
import { IonicApp, IonicErrorHandler, IonicModule } from 'ionic-angular';
import { SplashScreen } from '@ionic-native/splash-screen';
import { StatusBar } from '@ionic-native/status-bar';

import { MyApp } from './app.component';
import { HomePage } from '../pages/home/home';

import { IonicStorageModule } from '@ionic/storage';
import { TaskService } from '../providers/task/task.service';
import { Network } from '@ionic-native/network';
import { TASK_API_URL } from '../config/task-api-url.injectiontoken';
import { HttpClientModule } from '@angular/common/http';

@NgModule({
  declarations: [
    MyApp,
    HomePage
  ],
  imports: [
    BrowserModule,
    HttpClientModule,
    IonicModule.forRoot(MyApp),
    IonicStorageModule.forRoot({
      name: '__dynamicbox',
      storeName: 'tasks',
      driverOrder: ['sqlite', 'indexeddb', 'websql', 'localstorage']
    })
  ],
  bootstrap: [IonicApp],
  entryComponents: [
    MyApp,
    HomePage
  ],
  providers: [
    StatusBar,
    SplashScreen,
    {provide: ErrorHandler, useClass: IonicErrorHandler},
    TaskService,
    Network,
    { provide: TASK_API_URL, useValue: 'http://localhost:3000/api/v1'}
  ]
})
export class AppModule {}
