/**
 * Azure DevOps API types for PR changes and diff information
 */

export interface PullRequestChange {
  item: {
    path: string;
  };
  changeType: 'add' | 'edit' | 'delete';
}

export interface GitChange {
  item: GitItem;
  changeType: VersionControlChangeType;
}

export interface GitItem {
  objectId?: string;
  originalObjectId?: string;
  gitObjectType?: GitObjectType;
  commitId?: string;
  path?: string;
  isFolder?: boolean;
  url?: string;
}

export enum VersionControlChangeType {
  None = 0,
  Add = 1,
  Edit = 2,
  Delete = 16,
  Rename = 32,
  Merge = 64
}

export enum GitObjectType {
  Bad = 0,
  Commit = 1,
  Tree = 2,
  Blob = 3,
  Tag = 4,
  Ext2 = 5,
  OfsDelta = 6,
  RefDelta = 7
}

export interface PullRequest {
  pullRequestId: number;
  title: string;
  description?: string;
  sourceRefName: string;
  targetRefName: string;
  status: PullRequestStatus;
  createdBy: IdentityRef;
  creationDate: Date;
  repository: GitRepository;
}

export interface GitRepository {
  id: string;
  name: string;
  url: string;
  project: TeamProjectReference;
}

export interface TeamProjectReference {
  id: string;
  name: string;
  description?: string;
  url: string;
}

export interface IdentityRef {
  displayName: string;
  url: string;
  id: string;
  uniqueName: string;
  imageUrl?: string;
  descriptor?: string;
}

export enum PullRequestStatus {
  NotSet = 0,
  Active = 1,
  Abandoned = 2,
  Completed = 3,
  All = 4
}