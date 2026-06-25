import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import {
  IonButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonContent,
  IonHeader,
  IonMenuButton,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { SneatAuthStateService } from '@sneat/auth-core';
import { UserRequiredFieldsService } from '@sneat/auth-ui';
import { SpacesCardComponent } from '@sneat/space-components';
import { SpaceService } from '@sneat/space-services';
import { map } from 'rxjs';

// Public landing page. Anonymous visitors get a New game CTA and cross-promo
// cards for the wider Sneat ecosystem; signed-in users additionally see their
// spaces (SpacesCard, which needs auth — hence gated on isSignedIn).
@Component({
  selector: 'gameboard-home-page',
  imports: [
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonButtons,
    IonMenuButton,
    IonButton,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    RouterLink,
    SpacesCardComponent,
  ],
  // SpaceService and UserRequiredFieldsService are @Injectable() (not
  // providedIn:'root' before @sneat 0.9.1). The embedded SpacesCard -> SpacesList
  // chain needs both, so this root-level landing page provides them.
  providers: [SpaceService, UserRequiredFieldsService],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-menu-button />
        </ion-buttons>
        <ion-title>GameBoard.live</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <ion-button expand="block" routerLink="/new-game">New game</ion-button>

      @if (isSignedIn()) {
        <sneat-spaces-card />
      }

      <!-- Cross-promo to the wider Sneat ecosystem. External links, new tab. -->
      <ion-card
        button
        href="https://sneat.team/"
        target="_blank"
        rel="noopener noreferrer"
      >
        <ion-card-header>
          <ion-card-title>Sneat.team</ion-card-title>
        </ion-card-header>
        <ion-card-content>Sports team management</ion-card-content>
      </ion-card>

      <ion-card
        button
        href="https://sneat.app/"
        target="_blank"
        rel="noopener noreferrer"
      >
        <ion-card-header>
          <ion-card-title>Sneat.app</ion-card-title>
        </ion-card-header>
        <ion-card-content>Super app for family management</ion-card-content>
      </ion-card>
    </ion-content>
  `,
})
export class GameboardHomePageComponent {
  private readonly authStateService = inject(SneatAuthStateService);

  protected readonly isSignedIn = toSignal(
    this.authStateService.authStatus.pipe(map((s) => s === 'authenticated')),
    { initialValue: false },
  );
}
