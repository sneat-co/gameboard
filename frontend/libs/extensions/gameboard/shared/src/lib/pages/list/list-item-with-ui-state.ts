import { UiState } from '@sneat/dto';
import { IListItemBrief } from '@sneat/extension-gameboard-contract';

export interface IListItemUiState extends UiState {
  readonly isChangingIsDone?: boolean;
}

export interface IListItemWithUiState {
  readonly brief: IListItemBrief;
  readonly state: IListItemUiState;
}
