import { uploadFileName } from "@/lib/storage/upload-key";
import { api } from "../api";

export type LibraryUpload = {
  key: string;
  url: string;
  kind: "image" | "video" | "audio" | "file";
  uploadedAt: string | null;
};

/** `image` lists pictures only; `all` adds audio and video. */
export type UploadListKind = "image" | "all";

const UPLOAD_LIST_KINDS: UploadListKind[] = ["image", "all"];

export const uploadsApi = api.injectEndpoints({
  endpoints: (build) => ({
    getUploads: build.query<LibraryUpload[], UploadListKind>({
      query: (kind) => ({ url: "uploads", params: kind === "all" ? { kind } : undefined }),
      transformResponse: (body: { uploads?: LibraryUpload[] }) => body.uploads ?? [],
      providesTags: ["Upload"],
    }),
    /** Saves a file and resolves to its upload key. */
    uploadFile: build.mutation<string, File>({
      query: (file) => {
        const body = new FormData();
        body.set("file", file);
        return { url: "uploads", method: "POST", body };
      },
      transformResponse: (body: { mediaKey?: string; imageKey?: string }) => body.mediaKey ?? body.imageKey ?? "",
      invalidatesTags: ["Upload"],
    }),
    /** Removes the upload from every cached list right away and restores it if the delete fails. */
    deleteUpload: build.mutation<void, string>({
      query: (key) => ({ url: `uploads/${uploadFileName(key)}`, method: "DELETE" }),
      async onQueryStarted(key, { dispatch, queryFulfilled }) {
        const patches = UPLOAD_LIST_KINDS.map((kind) =>
          dispatch(
            uploadsApi.util.updateQueryData("getUploads", kind, (uploads) =>
              uploads.filter((upload) => upload.key !== key),
            ),
          ),
        );
        await queryFulfilled.catch(() => {
          for (const patch of patches) patch.undo();
        });
      },
    }),
  }),
});

export const { useGetUploadsQuery, useUploadFileMutation, useDeleteUploadMutation } = uploadsApi;
