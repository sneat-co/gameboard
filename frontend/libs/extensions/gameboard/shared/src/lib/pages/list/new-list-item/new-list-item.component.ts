import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
  signal,
  viewChild,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  IonButton,
  IonIcon,
  IonInput,
  IonItem,
  ToastController,
} from '@ionic/angular/standalone';
import { ErrorLogger, IErrorLogger } from '@sneat/core';
import { RandomIdService } from '@sneat/random';
import { ISpaceContext } from '@sneat/space-models';
import {
  IListContext,
  ICreateListItemRequest,
  IGameboardService,
  GAMEBOARD_SERVICE,
} from '@sneat/extension-gameboard-contract';
import { EmojisLoaderService } from '../../../services';
import { IListItemWithUiState } from '../list-item-with-ui-state';

@Component({
  selector: 'gameboard-new-list-item',
  imports: [FormsModule, IonItem, IonIcon, IonInput, IonButton],
  templateUrl: './new-list-item.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NewListItemComponent {
  private readonly errorLogger = inject<IErrorLogger>(ErrorLogger);
  private readonly randomService = inject(RandomIdService);
  private readonly toastCtrl = inject(ToastController);
  private readonly listService = inject<IGameboardService>(GAMEBOARD_SERVICE);
  private readonly emojisLoader = inject(EmojisLoaderService);

  protected readonly isFocused = signal(false);

  protected readonly isAdding = signal(false);

  public readonly isDone = input(false);
  public readonly disabled = input(false);
  public readonly space = input.required<ISpaceContext | undefined>();
  public readonly list = input.required<IListContext | undefined>();

  protected readonly newItemInput = viewChild<IonInput>('newItemInput');

  public readonly adding = output<IListItemWithUiState>();
  public readonly added = output<IListItemWithUiState>();
  public readonly failedToAdd = output<string>();

  protected readonly title = signal('');

  protected focused(): void {
    this.isFocused.set(true);
  }

  protected add(): void {
    if (!this.title().trim()) {
      return;
    }
    let id = '';
    for (let i = 0; i < 100; i++) {
      id = this.randomService.newRandomId({ len: 3 });
      if (!this.list()?.dbo?.items?.some((item) => item.id === id)) {
        break;
      }
    }
    let item: ICreateListItemRequest = {
      id,
      title: this.title(),
    };

    // Async emoji detection
    this.emojisLoader
      .detectEmoji(item.title)
      .then((emoji) => {
        if (emoji) {
          item = { ...item, emoji };
        }
      })
      .catch((err) => {
        this.errorLogger.logError(err, 'Failed to detect emoji');
        // Continue without emoji
      })
      .finally(() => {
        // Always apply isDone and create the item
        if (this.isDone()) {
          item = { ...item, isDone: true };
        }
        this.createListItem(item);
      });
  }

  protected clear(): void {
    this.title.set('');
  }

  // Is intentionally public to be called from wrapping component.
  public focus(): void {
    const newItemInput = this.newItemInput();
    if (!newItemInput) {
      this.errorLogger.logError('!this.newItemInput');
      return;
    }
    newItemInput.setFocus().catch(this.errorLogger.logError);
  }

  protected createListItem(listItemBrief: ICreateListItemRequest): void {
    const space = this.space();
    const list = this.list();
    console.log('ListPage.createListItem', listItemBrief, list, space);
    if (!listItemBrief) {
      throw new Error('movie is a required parameter');
    }
    if (!space) {
      throw new Error('no team context');
    }
    this.isAdding.set(true);
    if (!list) {
      throw new Error('no list context');
    }
    this.title.set('');
    this.adding.emit({ brief: listItemBrief, state: { isAdding: true } });
    this.listService
      .createListItems({
        space,
        list,
        items: [listItemBrief],
      })
      .subscribe({
        next: (result) => {
          if (result.success) {
            this.clear();
            this.focus();
          } else if (result.message) {
            this.showToast({ color: 'danger', message: result.message });
          }

          // if (!this.communeRealId && result.communeDto) {
          // 	this.setPageCommuneIds(
          // 		'addMovieToWatchlist',
          // 		{
          // 			short: this.communeShortId,
          // 			real: result.communeDto.id,
          // 		},
          // 		result.communeDto,
          // 	);
          // }
          this.isAdding.set(false);
          this.added.emit({ brief: listItemBrief, state: {} });
          setTimeout(() => {
            this.focus();
          }, 100);
        },
        error: (err) => {
          this.errorLogger.logError(err, 'Failed to add item to list');
          this.isAdding.set(false);
          this.failedToAdd.emit(listItemBrief.id);
          this.focus();
        },
      });
  }

  protected showToast(opts: {
    message: string;
    duration?: number;
    color?: string;
  }): void {
    const worker = async () => {
      const toast = await this.toastCtrl.create({
        ...opts,
        duration: opts.duration || 2000,
        buttons: [{ role: 'cancel', text: 'OK' }],
      });
      await toast.present();
    };
    worker().catch((err) => {
      this.errorLogger.logError(err, 'Failed to display toast');
    });
  }
}
