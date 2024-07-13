import CRDT from './crdt';
import RemoteCursor from './remoteCursor';
import CodeMirror from 'codemirror';
import './plantumlMode';

class Editor {
  constructor(changeCallback) {
    const el = document.getElementsByTagName("textarea")[0];
    this.changeCallback = changeCallback;
    console.log(CodeMirror.modes);
    this.codemirror = CodeMirror.fromTextArea(el, {
      mode: {
        name: "plantuml",
      },
      tabSize: 2,
      indentUnit: 2,
      indentWithTabs: false,
      lineNumbers: false,
      autofocus: false,
      lineWrapping: false,
      allowDropFileTypes: ["text/plain"],
      placeholder: "Share the link to invite collaborators to your document. Drag and drop files to insert contents.",
      styleSelectedText: true,
    });
    this.controller = null;
    this.remoteCursors = {};
  }

  bindButtons() {
    this.bindSaveLink();
  }

  bindSaveLink(doc=document) {
    const aTag = doc.querySelector('#saveLink');
    aTag.addEventListener("click", async () => {
      const textToSave = this.codemirror.getValue();
      const textAsBlob = new Blob([textToSave], {type:"text/plain"});
      const fileName = "collaboration-" + Date.now();

      let success = false;
      if (
        window.showSaveFilePicker != null 
        && window.FileSystemFileHandle.prototype.createWritable != null 
        && window.FileSystemWritableFileStream.prototype.write != null
        && window.FileSystemWritableFileStream.prototype.close != null
      ) {
        try {
          const fileHandle = await showSaveFilePicker({suggestedName: fileName});
          const writeable = await fileHandle.createWritable();
          try {
            await writeable.write(textAsBlob);
          } finally {
            await writeable.close();
          }
          success = true;
        } catch (err) {
          alert('Error saving to filesystem. Downloading with default name');
        }
      } 
      if (!success) {
        const textAsURL = window.URL.createObjectURL(textAsBlob);
        const saveLink = document.createElement("a");

        saveLink.download = fileName;
        saveLink.innerHTML = "Save File";
        saveLink.href = textAsURL;
        saveLink.onclick = this.onSaveLinkClick;
        saveLink.style.display = "none";

        document.body.appendChild(saveLink);
        saveLink.click();
      }
    });
  }

  onSaveLinkClick(e, doc=document) {
    doc.body.removeChild(e.target);
  }

  bindChangeEvent() {
    this.codemirror.on("change", (_, changeObj) => {
      this.changeCallback(this.codemirror.getValue());
      if (changeObj.origin === "setValue") return;
      if (changeObj.origin === "insertText") return;
      if (changeObj.origin === "deleteText") return;

      switch(changeObj.origin) {
        case 'redo':
        case 'undo':
          this.processUndoRedo(changeObj);
          break;
        case '*compose':
        case '+input':
        case 'paste':
          this.processInsert(changeObj);
          break;
        case '+delete':
        case 'cut':
          this.processDelete(changeObj);
          break;
        default:
          throw new Error("Unknown operation attempted in editor.");
      }
    });
  }

  processInsert(changeObj) {
    this.processDelete(changeObj);
    const chars = this.extractChars(changeObj.text);
    const startPos = changeObj.from;

    this.updateRemoteCursorsInsert(chars, changeObj.to);
    this.controller.localInsert(chars, startPos);
  }

  isEmpty(textArr) {
    return textArr.length === 1 && textArr[0].length === 0;
  }

  processDelete(changeObj) {
    if (this.isEmpty(changeObj.removed)) return;
    const startPos = changeObj.from;
    const endPos = changeObj.to;
    const chars = this.extractChars(changeObj.removed);

    this.updateRemoteCursorsDelete(chars, changeObj.to, changeObj.from);
    this.controller.localDelete(startPos, endPos);
  }

  processUndoRedo(changeObj) {
    if (changeObj.removed[0].length > 0) {
      this.processDelete(changeObj);
    } else {
      this.processInsert(changeObj);
    }
  }

  extractChars(text) {
    if (text[0] === '' && text[1] === '' && text.length === 2) {
      return '\n';
    } else {
      return text.join("\n");
    }
  }

  replaceText(text) {
    const cursor = this.codemirror.getCursor();
    this.codemirror.getDoc().setValue(text);
    this.codemirror.setCursor(cursor);
  }

  insertText(value, positions, siteId) {
    const localCursor = this.codemirror.getCursor();
    const delta = this.generateDeltaFromChars(value);

    this.codemirror.replaceRange(value, positions.from, positions.to, 'insertText');
    this.updateRemoteCursorsInsert(positions.to, siteId);
    this.updateRemoteCursor(positions.to, siteId, 'insert', value);

    if (localCursor.line > positions.to.line) {
      localCursor.line += delta.line
    } else if (localCursor.line === positions.to.line && localCursor.ch > positions.to.ch) {
      if (delta.line > 0) {
        localCursor.line += delta.line
        localCursor.ch -= positions.to.ch;
      }

      localCursor.ch += delta.ch;
    }

    this.codemirror.setCursor(localCursor);
  }

  removeCursor(siteId) {
    const remoteCursor = this.remoteCursors[siteId];

    if (remoteCursor) {
      remoteCursor.detach();

      delete this.remoteCursors[siteId];
    }
  }

  updateRemoteCursorsInsert(chars, position, siteId) {
    const positionDelta = this.generateDeltaFromChars(chars);

    for (const cursorSiteId in this.remoteCursors) {
      if (cursorSiteId === siteId) continue;
      const remoteCursor = this.remoteCursors[cursorSiteId];
      const newPosition = Object.assign({}, remoteCursor.lastPosition);

      if (newPosition.line > position.line) {
        newPosition.line += positionDelta.line;
      } else if (newPosition.line === position.line && newPosition.ch > position.ch) {
        if (positionDelta.line > 0) {
          newPosition.line += positionDelta.line;
          newPosition.ch -= position.ch;
        }

        newPosition.ch += positionDelta.ch;
      }

      remoteCursor.set(newPosition)
    }
  }

  updateRemoteCursorsDelete(chars, to, from, siteId) {
    const positionDelta = this.generateDeltaFromChars(chars);

    for (const cursorSiteId in this.remoteCursors) {
      if (cursorSiteId === siteId) continue;
      const remoteCursor = this.remoteCursors[cursorSiteId];
      const newPosition = Object.assign({}, remoteCursor.lastPosition);

      if (newPosition.line > to.line) {
        newPosition.line -= positionDelta.line;
      } else if (newPosition.line === to.line && newPosition.ch > to.ch) {
        if (positionDelta.line > 0) {
          newPosition.line -= positionDelta.line;
          newPosition.ch += from.ch;
        }

        newPosition.ch -= positionDelta.ch;
      }

      remoteCursor.set(newPosition)
    }
  }

  updateRemoteCursor(position, siteId, opType, value) {
    const remoteCursor = this.remoteCursors[siteId];
    const clonedPosition = Object.assign({}, position);

    if (opType === 'insert') {
      if (value === '\n') {
        clonedPosition.line++;
        clonedPosition.ch = 0
      } else {
        clonedPosition.ch++;
      }
    } else {
      clonedPosition.ch--;
    }

    if (remoteCursor) {
      remoteCursor.set(clonedPosition);
    } else {
      this.remoteCursors[siteId] = new RemoteCursor(this.codemirror, siteId, clonedPosition);
    }
  }

  deleteText(value, positions, siteId) {
    const localCursor = this.codemirror.getCursor();
    const delta = this.generateDeltaFromChars(value);

    this.codemirror.replaceRange("", positions.from, positions.to, 'deleteText');
    this.updateRemoteCursorsDelete(positions.to, siteId);
    this.updateRemoteCursor(positions.to, siteId, 'delete');

    if (localCursor.line > positions.to.line) {
      localCursor.line -= delta.line;
    } else if (localCursor.line === positions.to.line && localCursor.ch > positions.to.ch) {
      if (delta.line > 0) {
        localCursor.line -= delta.line;
        localCursor.ch += positions.from.ch;
      }

      localCursor.ch -= delta.ch;
    }

    this.codemirror.setCursor(localCursor);
  }

  generateDeltaFromChars(chars) {
    const delta = { line: 0, ch: 0 };
    let counter = 0;

    while (counter < chars.length) {
      if (chars[counter] === '\n') {
        delta.line++;
        delta.ch = 0;
      } else {
        delta.ch++;
      }

      counter++;
    }

    return delta;
  }
}

export default Editor;
