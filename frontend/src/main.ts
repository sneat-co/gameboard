import { bootstrapApplication } from '@angular/platform-browser';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { AppComponent } from './app/app.component';
import { API_BASE } from './app/api.service';

bootstrapApplication(AppComponent, {
  providers: [
    provideZonelessChangeDetection(),
    provideHttpClient(),
    { provide: API_BASE, useValue: (globalThis as { __GB_API__?: string }).__GB_API__ ?? '' },
  ],
}).catch((err) => console.error(err));
