import {
  PointerHistoryClearResponse,
  PointerHistoryGetResponse,
  PointerHistoryListResponse,
  PointerHistorySummary,
  PointerMessageType,
} from '@dom-pointer-mcp/shared/types';
import autoAssignOverlayPositionAndSize from '../utils/position';
import { t } from '../i18n';

interface HistoryElement {
  selector: string;
  tagName?: string;
  id?: string;
  classes?: string[];
  attributes?: Record<string, string>;
  position?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

interface HistorySelection {
  selectionId?: string;
  url: string;
  userNote: string;
  timestamp: string;
  elements: HistoryElement[];
}

interface RuntimeResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

interface HistoryOverlay {
  overlay: HTMLDivElement;
  cleanup: () => void;
}

const ROOT_CLASS = 'dom-pointer-mcp__history-drawer';
const OPEN_CLASS = 'is-open';
const ACTIVE_CLASS = 'is-active';

function isExtensionContextValid(): boolean {
  try {
    return typeof chrome !== 'undefined'
      && !!chrome.runtime
      && typeof chrome.runtime.sendMessage === 'function'
      && !!chrome.runtime.id;
  } catch {
    return false;
  }
}

export default class HistoryDrawerService {
  private root: HTMLDivElement | null = null;

  private list: HTMLDivElement | null = null;

  private status: HTMLDivElement | null = null;

  private summaries: PointerHistorySummary[] = [];

  private overlays: HistoryOverlay[] = [];

  private activeSelectionId: string | null = null;

  public mount(): void {
    if (this.root) return;
    this.build();
    this.loadHistory();
  }

  public destroy(): void {
    this.clearHistoryOverlays();
    this.root?.remove();
    this.root = null;
    this.list = null;
    this.status = null;
    this.summaries = [];
    this.activeSelectionId = null;
  }

  private build(): void {
    this.root = document.createElement('div');
    this.root.className = ROOT_CLASS;
    this.root.innerHTML = `
      <button type="button" class="dom-pointer-mcp__history-tab" data-action="toggle">${t('history.tab')}</button>
      <section class="dom-pointer-mcp__history-panel" aria-label="${t('history.title')}">
        <header class="dom-pointer-mcp__history-header">
          <strong>${t('history.title')}</strong>
          <button type="button" data-action="refresh">${t('history.refresh')}</button>
        </header>
        <div class="dom-pointer-mcp__history-toolbar">
          <button type="button" data-action="show-all">${t('history.showAll')}</button>
          <button type="button" data-action="hide">${t('history.hide')}</button>
          <button type="button" data-action="clear-all" class="dom-pointer-mcp__history-danger">${t('history.clearAll')}</button>
        </div>
        <div class="dom-pointer-mcp__history-status"></div>
        <div class="dom-pointer-mcp__history-list"></div>
      </section>
    `;

    this.list = this.root.querySelector('.dom-pointer-mcp__history-list');
    this.status = this.root.querySelector('.dom-pointer-mcp__history-status');

    this.root.addEventListener('click', (event) => this.handleClick(event));
    this.root.addEventListener('pointerdown', (event) => event.stopPropagation(), true);
    this.root.addEventListener('mousedown', (event) => event.stopPropagation(), true);

    document.body.appendChild(this.root);
  }

  private async handleClick(event: MouseEvent): Promise<void> {
    const target = event.target as HTMLElement | null;
    const actionEl = target?.closest<HTMLElement>('[data-action]');
    if (!actionEl) return;

    event.preventDefault();
    event.stopPropagation();

    const { action } = actionEl.dataset;
    if (action === 'toggle') {
      this.root?.classList.toggle(OPEN_CLASS);
      if (this.root?.classList.contains(OPEN_CLASS)) {
        await this.loadHistory();
      }
      return;
    }

    if (action === 'refresh') {
      await this.loadHistory();
      return;
    }

    if (action === 'hide') {
      this.clearHistoryOverlays();
      this.activeSelectionId = null;
      this.renderList();
      return;
    }

    if (action === 'show-all') {
      await this.showAllOnPage();
      return;
    }

    if (action === 'clear-all') {
      await this.clearHistory();
      return;
    }

    if (action === 'show-one') {
      const { selectionId } = actionEl.dataset;
      if (selectionId) {
        await this.showSelectionOnPage(selectionId);
      }
      return;
    }

    if (action === 'delete-one') {
      const { selectionId } = actionEl.dataset;
      if (selectionId) {
        await this.clearHistory(selectionId);
      }
    }
  }

  private async loadHistory(): Promise<void> {
    this.setStatus(t('history.loading'));
    try {
      const response = await this.sendRuntimeMessage<PointerHistoryListResponse>({
        type: PointerMessageType.HISTORY_LIST_REQUEST,
      });
      this.summaries = response.selections ?? [];
      this.setStatus(this.summaries.length === 0 ? t('history.empty') : '');
      this.renderList();
    } catch (error) {
      this.setStatus(t('history.loadFailed', { error: (error as Error).message }));
    }
  }

  private renderList(): void {
    if (!this.list) return;
    this.list.innerHTML = '';

    if (this.summaries.length === 0) {
      return;
    }

    this.summaries.forEach((summary, index) => {
      const item = document.createElement('article');
      item.className = 'dom-pointer-mcp__history-item';
      item.classList.toggle(ACTIVE_CLASS, this.activeSelectionId === summary.selectionId);
      item.classList.toggle('is-current-page', this.isCurrentPage(summary.url));

      const main = document.createElement('div');
      main.className = 'dom-pointer-mcp__history-item-main';

      const title = document.createElement('div');
      title.className = 'dom-pointer-mcp__history-item-title';
      title.textContent = `#${index + 1} ${summary.elementCount} ${t('history.elements')}`;

      const time = document.createElement('time');
      time.className = 'dom-pointer-mcp__history-time';
      time.textContent = summary.timestamp;

      const note = document.createElement('div');
      note.className = 'dom-pointer-mcp__history-note';
      note.textContent = summary.userNotePreview || t('history.noNote');

      const meta = document.createElement('div');
      meta.className = 'dom-pointer-mcp__history-meta';
      meta.textContent = [
        this.isCurrentPage(summary.url) ? t('history.currentPage') : t('history.otherPage'),
        summary.screenshotPath ? t('history.hasScreenshot') : '',
      ].filter(Boolean).join(' · ');

      main.append(title, time, note, meta);

      const actions = document.createElement('div');
      actions.className = 'dom-pointer-mcp__history-item-actions';

      const showButton = document.createElement('button');
      showButton.type = 'button';
      showButton.dataset.action = 'show-one';
      showButton.dataset.selectionId = summary.selectionId;
      showButton.textContent = t('history.show');
      showButton.disabled = !this.isCurrentPage(summary.url);

      const deleteButton = document.createElement('button');
      deleteButton.type = 'button';
      deleteButton.dataset.action = 'delete-one';
      deleteButton.dataset.selectionId = summary.selectionId;
      deleteButton.className = 'dom-pointer-mcp__history-danger';
      deleteButton.textContent = t('history.delete');

      actions.append(showButton, deleteButton);

      item.append(main, actions);
      this.list!.appendChild(item);
    });
  }

  private async clearHistory(selectionId?: string): Promise<void> {
    const confirmed = window.confirm(
      selectionId ? t('history.confirmDelete') : t('history.confirmClearAll'),
    );
    if (!confirmed) return;

    try {
      const response = await this.sendRuntimeMessage<PointerHistoryClearResponse>({
        type: PointerMessageType.HISTORY_CLEAR_REQUEST,
        selectionId,
      });

      if (!selectionId || selectionId === this.activeSelectionId || this.activeSelectionId === '__all__') {
        this.clearHistoryOverlays();
        this.activeSelectionId = null;
      }

      this.setStatus(t('history.cleared', { count: response.removed }));
      await this.loadHistory();
    } catch (error) {
      this.setStatus(t('history.clearFailed', { error: (error as Error).message }));
    }
  }

  private async showAllOnPage(): Promise<void> {
    const current = this.summaries.filter((summary) => this.isCurrentPage(summary.url));
    if (current.length === 0) {
      this.clearHistoryOverlays();
      this.setStatus(t('history.noCurrentPageItems'));
      return;
    }

    this.clearHistoryOverlays();
    this.activeSelectionId = '__all__';
    const selections = await Promise.all(
      current.map((summary) => this.fetchSelection(summary.selectionId)),
    );
    selections.forEach((selection, selectionIndex) => {
      if (selection) {
        this.renderSelectionOverlays(selection, `${selectionIndex + 1}.`);
      }
    });
    this.renderList();
  }

  private async showSelectionOnPage(selectionId: string): Promise<void> {
    this.clearHistoryOverlays();
    const selection = await this.fetchSelection(selectionId);
    if (!selection) {
      this.setStatus(t('history.missingSelection'));
      return;
    }

    if (!this.isCurrentPage(selection.url)) {
      this.setStatus(t('history.otherPage'));
      return;
    }

    this.activeSelectionId = selectionId;
    const rendered = this.renderSelectionOverlays(selection, '');
    this.setStatus(rendered === 0 ? t('history.noMatches') : '');
    this.renderList();
  }

  private async fetchSelection(selectionId: string): Promise<HistorySelection | null> {
    const response = await this.sendRuntimeMessage<PointerHistoryGetResponse>({
      type: PointerMessageType.HISTORY_GET_REQUEST,
      selectionId,
    });
    return response.selection as HistorySelection | null;
  }

  private renderSelectionOverlays(selection: HistorySelection, prefix: string): number {
    let rendered = 0;
    selection.elements.forEach((element, index) => {
      const target = this.findElement(element);
      if (!target) return;
      this.createHistoryOverlay(target, `${prefix}${index + 1}`);
      rendered += 1;
    });
    return rendered;
  }

  private createHistoryOverlay(target: HTMLElement, label: string): void {
    const overlay = document.createElement('div');
    overlay.className = 'dom-pointer-mcp__overlay dom-pointer-mcp__overlay--history';

    const badge = document.createElement('span');
    badge.className = 'dom-pointer-mcp__overlay-index dom-pointer-mcp__overlay-index--history';
    badge.textContent = label;
    overlay.appendChild(badge);

    document.body.appendChild(overlay);
    const cleanup = autoAssignOverlayPositionAndSize(target, overlay);
    this.overlays.push({ overlay, cleanup });
  }

  private clearHistoryOverlays(): void {
    this.overlays.forEach(({ overlay, cleanup }) => {
      cleanup();
      overlay.remove();
    });
    this.overlays = [];
  }

  private findElement(element: HistoryElement): HTMLElement | null {
    const selectors = this.buildSelectorCandidates(element);
    for (let i = 0; i < selectors.length; i += 1) {
      try {
        const matched = Array.from(document.querySelectorAll(selectors[i]))
          .filter((node): node is HTMLElement => node instanceof HTMLElement);
        const best = this.pickBestElement(matched, element);
        if (best) return best;
      } catch {
        // Try the next selector candidate.
      }
    }
    return null;
  }

  private buildSelectorCandidates(element: HistoryElement): string[] {
    const selectors: string[] = [];
    if (element.selector && element.selector !== 'unknown') {
      selectors.push(element.selector);
    }

    if (element.id) {
      selectors.push(`#${this.escapeIdentifier(element.id)}`);
    }

    const stableAttr = ['data-testid', 'data-test', 'data-cy', 'name', 'aria-label']
      .find((attr) => element.attributes?.[attr]);
    const tag = (element.tagName || '*').toLowerCase();
    if (stableAttr && element.attributes?.[stableAttr]) {
      selectors.push(`${tag}[${stableAttr}="${this.escapeAttributeValue(element.attributes[stableAttr])}"]`);
    }

    if (element.classes && element.classes.length > 0) {
      selectors.push(`${tag}.${element.classes.slice(0, 3).map((cls) => this.escapeIdentifier(cls)).join('.')}`);
    }

    selectors.push(tag);
    return Array.from(new Set(selectors.filter(Boolean)));
  }

  private pickBestElement(elements: HTMLElement[], expected: HistoryElement): HTMLElement | null {
    if (elements.length === 0) return null;
    if (elements.length === 1 || !expected.position) return elements[0];

    return elements
      .map((element) => ({
        element,
        score: this.positionScore(element.getBoundingClientRect(), expected.position!),
      }))
      .sort((a, b) => a.score - b.score)[0]?.element ?? null;
  }

  private positionScore(
    actual: DOMRect,
    expected: NonNullable<HistoryElement['position']>,
  ): number {
    return Math.abs(actual.x - expected.x)
      + Math.abs(actual.y - expected.y)
      + Math.abs(actual.width - expected.width)
      + Math.abs(actual.height - expected.height);
  }

  private escapeIdentifier(value: string): string {
    return window.CSS?.escape ? window.CSS.escape(value) : value.replace(/[^a-zA-Z0-9_-]/g, '\\$&');
  }

  private escapeAttributeValue(value: string): string {
    return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  }

  private isCurrentPage(url: string): boolean {
    try {
      const source = new URL(url);
      const current = new URL(window.location.href);
      return source.origin === current.origin && source.pathname === current.pathname;
    } catch {
      return url === window.location.href;
    }
  }

  private setStatus(text: string): void {
    if (!this.status) return;
    this.status.textContent = text;
    this.status.hidden = text.length === 0;
  }

  private sendRuntimeMessage<T>(message: Record<string, any>): Promise<T> {
    return new Promise((resolve, reject) => {
      if (!isExtensionContextValid()) {
        reject(new Error(t('extension.reloaded')));
        return;
      }

      chrome.runtime.sendMessage(message, (response: RuntimeResponse<T>) => {
        if (chrome.runtime?.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }

        if (!response?.success || !response.data) {
          reject(new Error(response?.error ?? 'Unknown history response'));
          return;
        }

        resolve(response.data);
      });
    });
  }
}
