/**
 * Data model interfaces and classes for the test repository.
 * This file contains multiple interfaces and classes with methods to test the code parsing functionality.
 */

/**
 * Base model interface for all data models
 */
export interface IBaseModel {
  id?: string;
  toDict(): Record<string, any>;
}

/**
 * Base model implementation
 */
export abstract class BaseModel implements IBaseModel {
  id?: string;
  
  constructor(id?: string) {
    this.id = id;
  }
  
  /**
   * Convert the model to a dictionary
   */
  toDict(): Record<string, any> {
    return {
      id: this.id
    };
  }
  
  /**
   * Create a model instance from a dictionary
   */
  static fromDict(data: Record<string, any>): BaseModel {
    throw new Error('Method must be implemented by subclass');
  }
}

/**
 * User model representing a system user
 */
export interface IUser extends IBaseModel {
  name?: string;
  email?: string;
  validate(): boolean;
}

/**
 * User model implementation
 */
export class User extends BaseModel implements IUser {
  name?: string;
  email?: string;
  
  constructor(id?: string, name?: string, email?: string) {
    super(id);
    this.name = name;
    this.email = email;
  }
  
  /**
   * Convert the user to a dictionary
   */
  toDict(): Record<string, any> {
    return {
      ...super.toDict(),
      name: this.name,
      email: this.email
    };
  }
  
  /**
   * Create a user instance from a dictionary
   */
  static fromDict(data: Record<string, any>): User {
    return new User(
      data.id,
      data.name,
      data.email
    );
  }
  
  /**
   * Validate the user data
   */
  validate(): boolean {
    if (!this.email || !this.email.includes('@')) {
      throw new Error('Invalid email address');
    }
    return true;
  }
}

/**
 * Repository model representing a code repository
 */
export interface IRepository extends IBaseModel {
  name?: string;
  url?: string;
  owner?: IUser;
  commits: ICommit[];
  addCommit(commit: ICommit): void;
}

/**
 * Commit interface representing a code commit
 */
export interface ICommit extends IBaseModel {
  message: string;
  timestamp: number;
  author: IUser;
}

/**
 * Repository model implementation
 */
export class Repository extends BaseModel implements IRepository {
  name?: string;
  url?: string;
  owner?: User;
  commits: Commit[] = [];
  
  constructor(id?: string, name?: string, url?: string, owner?: User) {
    super(id);
    this.name = name;
    this.url = url;
    this.owner = owner;
  }
  
  /**
   * Convert the repository to a dictionary
   */
  toDict(): Record<string, any> {
    return {
      ...super.toDict(),
      name: this.name,
      url: this.url,
      owner: this.owner?.toDict(),
      commits: this.commits.map(commit => commit.toDict())
    };
  }
  
  /**
   * Add a commit to the repository
   */
  addCommit(commit: Commit): void {
    this.commits.push(commit);
  }
  
  /**
   * Create a repository instance from a dictionary
   */
  static fromDict(data: Record<string, any>, users: Record<string, User> = {}): Repository {
    const repo = new Repository(
      data.id,
      data.name,
      data.url
    );
    
    // Set owner if available
    const ownerData = data.owner;
    if (ownerData && ownerData.id && users[ownerData.id]) {
      repo.owner = users[ownerData.id];
    }
    
    return repo;
  }
}

/**
 * Commit model implementation
 */
export class Commit extends BaseModel implements ICommit {
  message: string;
  timestamp: number;
  author: User;
  
  constructor(id: string, message: string, timestamp: number, author: User) {
    super(id);
    this.message = message;
    this.timestamp = timestamp;
    this.author = author;
  }
  
  /**
   * Convert the commit to a dictionary
   */
  toDict(): Record<string, any> {
    return {
      ...super.toDict(),
      message: this.message,
      timestamp: this.timestamp,
      author: this.author.toDict()
    };
  }
  
  /**
   * Create a commit instance from a dictionary
   */
  static fromDict(data: Record<string, any>, users: Record<string, User> = {}): Commit {
    const authorData = data.author;
    let author: User;
    
    if (authorData && authorData.id && users[authorData.id]) {
      author = users[authorData.id];
    } else {
      author = new User(authorData?.id, authorData?.name, authorData?.email);
    }
    
    return new Commit(
      data.id,
      data.message,
      data.timestamp,
      author
    );
  }
}

/**
 * Create a new user with the given name and email
 */
export function createUser(name: string, email: string): User {
  const user = new User(undefined, name, email);
  user.id = generateId();
  return user;
}

/**
 * Generate a unique ID
 */
export function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15);
}
