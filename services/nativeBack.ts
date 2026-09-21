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
      handlerStack.pop();


    if (!entry) {
      return false;
    }


    entry.handler();

    return true;
  };