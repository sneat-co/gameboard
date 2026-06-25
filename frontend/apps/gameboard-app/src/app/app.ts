import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import {
  IonApp,
  IonContent,
  IonHeader,
  IonMenu,
  IonRouterOutlet,
  IonSplitPane,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { BaseAppComponent } from '@sneat/app';
import { AuthMenuItemComponent } from '@sneat/auth-ui';
import { filter, map } from 'rxjs';

// Extends BaseAppComponent for the shared app lifecycle (redirect sign-in
// completion, title strategy, analytics, current-space clearing). Hosts a side
// menu (like sneat-app): on a space route it renders that space's menu via the
// named "menu" outlet (which the space routes mount SpaceMenuComponent into —
// without this outlet the space route fails to activate and its pages, e.g.
// lists, never render); elsewhere it shows the spaces list + signed-in user.
@Component({
  selector: 'gameboard-root',
  template: `
    <ion-app>
      <ion-split-pane contentId="main">
        <ion-menu menuId="mainMenu" contentId="main" #menu>
          <ion-header>
            <ion-toolbar color="light">
              <ion-title>
                <!-- Breadcrumb: brand -> landing site root (/), then the app
                     root (/app/, i.e. the router's '/'). The brand is a plain
                     anchor because it leaves the Angular app for the landing. -->
                <a href="/">GameBoard.live</a>
                <span class="crumb-sep">/</span>
                <a [routerLink]="'/'" (click)="menu.close()">App</a>
              </ion-title>
            </ion-toolbar>
          </ion-header>
          <ion-content>
            @if (showRouteMenu()) {
              <ion-router-outlet name="menu" [animated]="false" />
            } @else {
              <sneat-auth-menu-item />
            }
          </ion-content>
        </ion-menu>
        <ion-router-outlet id="main" />
      </ion-split-pane>
    </ion-app>
  `,
  styles: `
    ion-title a {
      color: inherit;
      text-decoration: none;
      cursor: pointer;
    }
    ion-title a:hover {
      text-decoration: underline;
    }
    .crumb-sep {
      margin: 0 0.35rem;
      opacity: 0.5;
    }
  `,
  imports: [
    IonApp,
    IonSplitPane,
    IonMenu,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonRouterOutlet,
    RouterLink,
    AuthMenuItemComponent,
  ],
})
export class App extends BaseAppComponent {
  private readonly appRouter = inject(Router);

  private readonly currentUrl = toSignal(
    this.appRouter.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
    ),
    { initialValue: this.appRouter.url },
  );

  // On a space route, render the space-specific side menu via the named outlet.
  protected readonly showRouteMenu = computed(() =>
    this.currentUrl().startsWith('/space/'),
  );
}
