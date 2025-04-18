/**
 * Helper class for {@link CompositeDataSource} to manage iterating on data sources and removing them on the fly.
 */
export class DataSourceList<T> {
  private _list: T[];
  private _circular: boolean;
  private _pos: number;

  /**
   * @param circular whether to loop off the end of the list back to the start
   * @param initialList of content
   */
  constructor(circular: boolean, initialList?: T[]) {
    this._list = initialList ? [...initialList] : [];
    this._circular = circular;
    this._pos = 0;
  }

  /**
   * Returns the current head and then iterates.
   */
  next(): T | undefined {
    if (this._list.length <= 0 || this._pos >= this._list.length) {
      return undefined;
    }

    const result = this._list[this._pos];

    if (this._circular) {
      this._pos = (this._pos + 1) % this._list.length;
    } else {
      this._pos += 1;
    }

    return result;
  }

  /**
   * Replaces all elements with the provided list and resets the position of head to the start.
   *
   * @param input that will replace existing list
   */
  replace(input: T[]): void {
    this._list = [...input];
    this._pos = 0;
  }

  /**
   * Removes the provided element from the list. If the removed element was the head, head moves to next. Consider head may be undefined if list is empty after removal.
   *
   * @param element to remove
   * @returns true if element was removed
   */
  remove(element: T): boolean {
    const index = this._list.indexOf(element);
    if (index < 0) {
      return false;
    }

    this._list.splice(index, 1);
    if (this._list.length > 0) {
      // if removed item was before head, adjust head
      if (index < this._pos) {
        this._pos -= 1;
      }

      if (this._circular && this._pos > this._list.length - 1) {
        this._pos = 0;
      }
    }
    return true;
  }

  /**
   * Reset the head position to the start of the list.
   */
  reset() {
    this._pos = 0;
  }

  /**
   * @returns the current head position in the list, 0 indexed.
   */
  pos() {
    return this._pos;
  }

  /**
   * @returns the current length of the list
   */
  length() {
    return this._list.length;
  }

  /**
   * Clears the list and resets head.
   */
  clear() {
    this._list = [];
    this._pos = 0;
  }
}
