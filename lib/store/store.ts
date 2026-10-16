import { combineSlices, configureStore } from "@reduxjs/toolkit";
import { api } from "./api";
import { editorSlice } from "./editor-slice";

const rootReducer = combineSlices(api, editorSlice);

/**
 * Undo history holds up to 100 full timelines, too large to walk on every
 * dispatch in development. Mutation args may hold Files and FormData.
 */
const ignoredPaths = ["editor.document.history", "editor.document.gestureBase"];
const nonSerializablePaths = [...ignoredPaths, /^api\.mutations\.[^.]+\.originalArgs/];

/** A new store per request on the server and per mounted provider in the browser. */
export const makeStore = () =>
  configureStore({
    reducer: rootReducer,
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        immutableCheck: { ignoredPaths },
        serializableCheck: { ignoredPaths: nonSerializablePaths },
      }).concat(api.middleware),
  });

export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<typeof rootReducer>;
export type AppDispatch = AppStore["dispatch"];
