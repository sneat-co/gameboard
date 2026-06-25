import { TitleCasePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonSelect,
  IonSelectOption,
  MenuController,
} from '@ionic/angular/standalone';
import { ISneatUserState } from '@sneat/auth-core';
import { IUserSpaceBrief } from '@sneat/auth-models';
import { AuthMenuItemComponent } from '@sneat/auth-ui';
import { ContactusServicesModule } from '@sneat/extension-contactus-internal';
import { IIdAndBrief } from '@sneat/core';
import {
  SpaceBaseComponent,
  SpaceComponentBaseParams,
} from '@sneat/space-components';
import { SpaceServiceModule } from '@sneat/space-services';
import { zipMapBriefsWithIDs } from '@sneat/space-models';
import { ClassName } from '@sneat/ui';
import { takeUntil } from 'rxjs/operators';
import { IListGroup, IGameboardSpaceDbo } from '@sneat/extension-gameboard-contract';
import { builtInListGroups } from '../pages/lists/built-in-lists';

// gameboard-specific side menu rendered in the space "menu" outlet. Unlike the
// generic @sneat SpaceMenuComponent (which hardcodes every sneat-app extension —
// Assets, Budget, Calendar, Contacts, Debts, …, none of which exist in
// gameboard-app), this shows only what template has: a space selector (to switch
// spaces, like sneat-app) and the selected space's lists.
@Component({
  selector: 'gameboard-space-menu',
  templateUrl: './gameboard-space-menu.component.html',
  imports: [
    TitleCasePipe,
    RouterLink,
    ContactusServicesModule,
    SpaceServiceModule,
    IonList,
    IonItem,
    IonSelect,
    IonSelectOption,
    IonIcon,
    IonLabel,
    IonNote,
    AuthMenuItemComponent,
  ],
  providers: [
    { provide: ClassName, useValue: 'GameboardSpaceMenuComponent' },
    SpaceComponentBaseParams,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GameboardSpaceMenuComponent extends SpaceBaseComponent {
  protected readonly $spaces = signal<
    readonly IIdAndBrief<IUserSpaceBrief>[] | undefined
  >(undefined);
  protected readonly $disabled = computed(() => !this.$spaceID());
  protected readonly $listGroups = signal<IListGroup[]>([]);

  private readonly menuCtrl = inject(MenuController);

  constructor() {
    super();
    this.spaceParams.userService.userState
      .pipe(takeUntil(this.destroyed$))
      .subscribe({
        next: (userState: ISneatUserState) =>
          this.$spaces.set(
            userState?.record
              ? zipMapBriefsWithIDs(userState.record.spaces) || []
              : undefined,
          ),
        error: this.errorLogger.logErrorHandler('failed to get user state'),
      });
    // Seed the built-in default lists (e.g. family To Buy / To Do) as soon as the
    // space type is known from the URL, before the space document loads. Mirrors
    // the lists page so the menu shows lists instantly; onSpaceDboChanged() below
    // re-seeds + merges persisted lists once the DBO arrives.
    this.spaceTypeChanged$
      .pipe(takeUntil(this.destroyed$))
      .subscribe((spaceType) => {
        if (spaceType && !this.$listGroups().length) {
          this.$listGroups.set([...builtInListGroups(spaceType)]);
        }
      });
  }

  // Mirror the lists page: built-in defaults (family) + the lists persisted on
  // the space DBO, deduped by group type.
  protected override onSpaceDboChanged(): void {
    super.onSpaceDboChanged();
    const groups: IListGroup[] = this.space
      ? [...builtInListGroups(this.space.type)]
      : [];
    const dbo = this.space?.dbo as unknown as IGameboardSpaceDbo | undefined;
    (dbo?.listGroups || []).forEach((g) => {
      if (!groups.some((x) => x.type === g.type)) {
        groups.push(g);
      }
    });
    this.$listGroups.set(groups);
  }

  protected onSpaceSelected(event: Event): void {
    const spaceID = (event as CustomEvent).detail.value as string;
    if (spaceID === this.space?.id) {
      return;
    }
    const space = this.$spaces()?.find((t) => t.id === spaceID);
    if (space) {
      this.setSpaceRef(space);
      this.spaceNav
        .navigateToSpace(space)
        .catch(
          this.errorLogger.logErrorHandler(
            'Failed to navigate to selected space',
          ),
        );
    }
    this.closeMenu();
  }

  protected closeMenu(): void {
    this.menuCtrl.close().catch(this.errorLogger.logError);
  }
}
