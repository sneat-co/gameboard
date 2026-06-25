import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { getStandardSneatProviders } from '@sneat/app';
import { SneatAuthStateService, SneatUserService } from '@sneat/auth-core';
import { BehaviorSubject } from 'rxjs';
import { gameboardAppEnvironmentConfig } from '../../environments/environment';
import { GameboardHomePageComponent } from './gameboard-home-page.component';

// The home page is a PUBLIC landing: everyone sees the New game CTA + cross-promo
// cards, and signed-in users additionally see their SpacesCard (gated on
// isSignedIn(), derived from SneatAuthStateService.authStatus). We drive that
// gate with a stub authStatus — the component and the embedded SpaceService only
// read `authStatus` from the service, so no Firebase auth needs standing up.
describe('GameboardHomePageComponent', () => {
  const userState$ = new BehaviorSubject<unknown>({
    status: 'authenticated',
    user: { uid: 'u1', isAnonymous: false, emailVerified: true, providerData: [] },
    record: {
      title: 'Test User',
      spaces: { s1: { title: 'Family', type: 'family', roles: ['creator'] } },
    },
  });

  function configure(authStatus: 'authenticated' | 'notAuthenticated') {
    TestBed.configureTestingModule({
      imports: [GameboardHomePageComponent],
      providers: [
        ...getStandardSneatProviders(gameboardAppEnvironmentConfig),
        provideRouter([]),
        // Override after the spread so the card sees a user with spaces.
        {
          provide: SneatUserService,
          useValue: { userState: userState$, currentUserID: 'u1' },
        },
        // Drive the isSignedIn() gate without standing up Firebase auth.
        {
          provide: SneatAuthStateService,
          useValue: { authStatus: new BehaviorSubject(authStatus) },
        },
      ],
    });
  }

  it('public (signed-out): shows New game CTA + cross-promo, no spaces card', () => {
    configure('notAuthenticated');
    const fixture = TestBed.createComponent(GameboardHomePageComponent);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('ion-button')?.textContent).toContain('New game');
    // The two cross-promo cards (Sneat.team, Sneat.app) render for everyone.
    expect(host.querySelectorAll('ion-card').length).toBeGreaterThanOrEqual(2);
    expect(host.querySelector('sneat-spaces-card')).toBeFalsy();
  });

  it('signed-in: renders the spaces card chain (SpaceService / UserRequiredFieldsService resolve, no NG0201)', () => {
    configure('authenticated');
    const fixture = TestBed.createComponent(GameboardHomePageComponent);
    // detectChanges constructs the embedded SpacesListComponent; if a provider
    // (SpaceService / UserRequiredFieldsService) is missing this throws NG0201.
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('sneat-spaces-card')).toBeTruthy();
    expect(host.querySelector('sneat-spaces-list')).toBeTruthy();
  });
});
