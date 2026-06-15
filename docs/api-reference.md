# Server Actions and API Reference

Neuron OS relies heavily on Next.js Server Actions rather than conventional API routes.

## Core Server Actions

### 1. Folders (`src/actions/folders.ts`)
- `createFolderAction(name, subjectId, parentFolderId)`
- `renameFolderAction(folderId, name)`
- `deleteFolderAction(folderId)`
- `moveFolderAction(folderId, targetSubjectId, targetFolderId)`

### 2. Subjects (`src/actions/subjects.ts`)
- `renameSubject(subjectId, name)`
- `moveToRecycleBin(itemId, itemType)`
- `restoreFromRecycleBin(itemId, itemType)`

### 3. Gamification (`src/actions/gamification.ts`)
- `getUserProgressAction()`
- `getLeaderboardAction()`
- `claimDailyRewardAction()`

### 4. Uploads (`src/actions/uploads.ts`)
- `saveUploadMetadata(fileName, fileUrl, fileType, fileSize)`
- `deleteDocumentPermanently(documentId)`
