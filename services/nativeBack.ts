type NativeBackHandler =
  () => void;


interface NativeBackEntry {
  id: number;

  handler:
    NativeBackHandler;
}


let nextHandlerId =
  1;


let handlerStack:
  NativeBackEntry[] =
  [];


/*
 * Register one temporary Android
 * Back-button handler.
 *
 * The most recently opened overlay
 * gets first priority.
 */
export const registerNativeBackHandler =
  (
    handler:
      NativeBackHandler,
  ): (() => void) => {
    const id =
      nextHandlerId++;


    handlerStack.push({
      id,
      handler,
    });


    /*
     * React effect cleanup removes this
     * handler when the overlay closes.
     */
    return () => {
      handlerStack =
        handlerStack.filter(
          (
            entry,
          ) =>
            entry.id !==
            id,
        );
    };
  };


/*
 * Called by App.tsx before normal
 * Android Back navigation.
 *
 * true:
 * an open overlay consumed Back.
 *
 * false:
 * App.tsx may continue with its
 * normal navigation / exit logic.
 */
export const consumeNativeBackHandler =
  (): boolean => {
    const entry =
      handlerStack[
        handlerStack.length -
        1
      ];


    if (!entry) {
      return false;
    }


    /*
     * Do NOT remove the handler here.
     *
     * The screen/overlay that registered
     * this handler owns its lifecycle.
     * React effect cleanup will remove it
     * when that screen actually unmounts.
     *
     * Removing it here with pop() creates
     * a gap during React navigation where
     * Android Back can fall through to
     * WebView/browser history.
     */
    entry.handler();

    return true;
  };