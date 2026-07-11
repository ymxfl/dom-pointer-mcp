import { createHash, randomUUID } from 'crypto';
import {
  PointerMessageType,
  type RawPointedSelection,
  type PointerHistoryClearRequest,
  type PointerHistoryGetRequest,
  type PointerHistoryRequest,
} from '@dom-pointer-mcp/shared/types';
import logger from './logger';
import ElementProcessor from './services/element-processor';
import SharedStateService from './services/shared-state-service';
import ScreenshotStorageService from './services/screenshot-storage-service';
import { SharedState, SharedStateData, ProcessedPointedSelection } from './types';
import { formatLocalTimestamp } from './utils/time';

function buildMetadata(messageType: string) {
  const now = formatLocalTimestamp(new Date());
  return {
    receivedAt: now,
    messageType,
  };
}

function createSelectionId(requestId?: unknown): string {
  if (typeof requestId === 'string' && requestId.length > 0 && requestId.length <= 128) {
    const digest = createHash('sha256').update(requestId).digest('hex').slice(0, 16);
    return `sel_${digest}`;
  }
  return `sel_${Date.now().toString(36)}_${randomUUID().slice(0, 8)}`;
}

async function buildState(
  type: string,
  data: any,
  services: HandlerServices,
): Promise<SharedState> {
  const raw = data as RawPointedSelection;
  const selectionId = createSelectionId(raw.requestId);
  let screenshot: ProcessedPointedSelection['screenshot'];

  try {
    screenshot = await services.screenshotStorage.save(selectionId, raw.screenshot);
  } catch (err) {
    logger.warn(`Failed to save selection screenshot: ${(err as Error).message}`);
  }

  const processed = services.elementProcessor.processBatchFromRaw(raw, {
    selectionId,
    screenshot,
  });

  const stateData: SharedStateData = {
    selectionId,
    rawPointedSelection: {
      ...raw,
      screenshot: undefined,
    },
    processedPointedSelection: processed,
    metadata: buildMetadata(type),
  };

  return { data: stateData };
}

async function buildStateFromMessage(
  type: string,
  data: any,
  services: HandlerServices,
): Promise<SharedState | null> {
  if (type === PointerMessageType.SELECTION_SENT) {
    return buildState(type, data, services);
  }

  if (type === PointerMessageType.DOM_ELEMENT_POINTED) {
    logger.warn(
      'Received legacy DOM_ELEMENT_POINTED message. '
      + 'Please upgrade the Chrome extension to a version that sends SELECTION_SENT.',
    );
    return null;
  }

  logger.warn(`Received unknown message type: ${type}`);
  return null;
}

interface HandlerServices {
  sharedState: SharedStateService;
  elementProcessor: ElementProcessor;
  screenshotStorage: ScreenshotStorageService;
}

type MessageResponder = (type: string, data: any) => void;

async function handleHistoryMessage(
  type: string,
  data: any,
  respond: MessageResponder,
  services: HandlerServices,
): Promise<boolean> {
  if (type === PointerMessageType.HISTORY_LIST_REQUEST) {
    const request = data as PointerHistoryRequest;
    const selections = await services.sharedState.listPointedSelections();
    respond(PointerMessageType.HISTORY_LIST_RESPONSE, {
      requestId: request?.requestId,
      selections,
    });
    return true;
  }

  if (type === PointerMessageType.HISTORY_GET_REQUEST) {
    const request = data as PointerHistoryGetRequest;
    const selection = request?.selectionId
      ? await services.sharedState.getPointedSelectionById(request.selectionId)
      : null;
    respond(PointerMessageType.HISTORY_GET_RESPONSE, {
      requestId: request?.requestId,
      selection,
    });
    return true;
  }

  if (type === PointerMessageType.HISTORY_CLEAR_REQUEST) {
    const request = data as PointerHistoryClearRequest;
    const removed = await services.sharedState.clearPointedSelections(request?.selectionId);
    respond(PointerMessageType.HISTORY_CLEAR_RESPONSE, {
      requestId: request?.requestId,
      removed,
    });
    return true;
  }

  return false;
}

const messageHandler = async (
  type: string,
  data: any,
  respond: MessageResponder,
  services: HandlerServices,
) => {
  if (await handleHistoryMessage(type, data, respond, services)) {
    return;
  }

  const buildedState = await buildStateFromMessage(type, data, services);
  if (buildedState) {
    const requestId = (data as RawPointedSelection | undefined)?.requestId;
    try {
      await services.sharedState.saveState(buildedState);
    } catch (error) {
      if (!requestId) throw error;
      respond(PointerMessageType.SELECTION_ACK, {
        requestId,
        success: false,
        error: (error as Error).message,
      });
      return;
    }
    if (requestId) {
      respond(PointerMessageType.SELECTION_ACK, {
        requestId,
        success: true,
        selectionId: buildedState.data.selectionId,
      });
    }
  }
};

export default messageHandler;
