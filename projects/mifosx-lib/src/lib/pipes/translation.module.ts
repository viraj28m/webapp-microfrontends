import { NgModule } from '@angular/core';
import { HttpClient, provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { TranslateModule, TranslateLoader } from '@ngx-translate/core';
import { createTranslateLoader } from './translation-loader';
import { LocationStrategy } from '@angular/common';


@NgModule({ exports: [TranslateModule], imports: [TranslateModule.forRoot({
            loader: {
                provide: TranslateLoader,
                useFactory: createTranslateLoader,
                deps: [HttpClient, LocationStrategy]
            }
        }),
        TranslateModule], providers: [provideHttpClient(withInterceptorsFromDi())] })
export class TranslationModule { }
