import { Memento } from "vscode";
import { log } from "./log";

export class LocalStorageService {

  constructor(private storage: Memento) { }

  public getValue<T>(key : string) : T | undefined {
    return this.storage.get<T>(key);
  }

  public setValue<T>(key : string, value : T) {
    this.storage.update(key, value );
  }
}