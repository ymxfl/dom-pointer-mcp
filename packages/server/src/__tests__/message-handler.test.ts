import { PointerMessageType, RawPointedSelection } from '@dom-pointer-mcp/shared/types';
import messageHandler from '../message-handler';
import ElementProcessor from '../services/element-processor';
import SharedStateService from '../services/shared-state-service';
import ScreenshotStorageService from '../services/screenshot-storage-service';

jest.mock('../logger', () => ({
  warn: jest.fn(),
}));

function selection(requestId: string): RawPointedSelection {
  return {
    requestId,
    url: 'https://example.com',
    timestamp: 1672531200000,
    userNote: 'make it blue',
    elements: [{
      outerHTML: '<button>Save</button>',
      url: 'https://example.com',
      timestamp: 1672531200000,
    }],
  };
}

function services(saveState: jest.Mock) {
  return {
    sharedState: { saveState } as unknown as SharedStateService,
    elementProcessor: new ElementProcessor(),
    screenshotStorage: {
      save: jest.fn().mockResolvedValue(undefined),
    } as unknown as ScreenshotStorageService,
  };
}

describe('messageHandler selection ACK', () => {
  it('acknowledges only after the selection has been persisted', async () => {
    const saveState = jest.fn().mockResolvedValue(undefined);
    const respond = jest.fn();

    await messageHandler(
      PointerMessageType.SELECTION_SENT,
      selection('request-1'),
      respond,
      services(saveState),
    );

    expect(saveState).toHaveBeenCalledTimes(1);
    expect(respond).toHaveBeenCalledWith(
      PointerMessageType.SELECTION_ACK,
      expect.objectContaining({
        requestId: 'request-1',
        success: true,
        selectionId: expect.any(String),
      }),
    );
    expect(saveState.mock.invocationCallOrder[0]).toBeLessThan(
      respond.mock.invocationCallOrder[0],
    );
  });

  it('uses an idempotent selection id when the same request is retried', async () => {
    const saveState = jest.fn().mockResolvedValue(undefined);
    const respond = jest.fn();
    const handlerServices = services(saveState);

    await messageHandler(
      PointerMessageType.SELECTION_SENT,
      selection('same-request'),
      respond,
      handlerServices,
    );
    await messageHandler(
      PointerMessageType.SELECTION_SENT,
      selection('same-request'),
      respond,
      handlerServices,
    );

    expect(respond.mock.calls[0][1].selectionId).toBe(respond.mock.calls[1][1].selectionId);
  });

  it('returns a negative ACK when persistence fails', async () => {
    const saveState = jest.fn().mockRejectedValue(new Error('disk full'));
    const respond = jest.fn();

    await messageHandler(
      PointerMessageType.SELECTION_SENT,
      selection('request-2'),
      respond,
      services(saveState),
    );

    expect(respond).toHaveBeenCalledWith(PointerMessageType.SELECTION_ACK, {
      requestId: 'request-2',
      success: false,
      error: 'disk full',
    });
  });
});
