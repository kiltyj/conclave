import Editor from './editor';
import CRDT from './crdt';
import Char from './char';
import Identifier from './identifier';
import VersionVector from './versionVector';
import Version from './version';
import Broadcast from './broadcast';
import { v1 as UUID } from 'uuid';
import { generateItemFromHash } from './hashAlgo';
import CSS_COLORS from './cssColors';
import { ANIMALS } from './cursorNames';

class Controller {
  constructor(targetPeerId, host, peer, broadcast, editor, doc=document, win=window) {
    this.siteId = UUID();
    this.host = host;
    this.buffer = [];
    this.network = [];
    this.urlId = targetPeerId;
    this.makeOwnName(doc);

    if (targetPeerId == 0) this.enableEditor();

    this.broadcast = broadcast;
    this.broadcast.controller = this;
    this.broadcast.bindServerEvents(targetPeerId, peer);

    this.editor = editor;
    this.editor.controller = this;
    this.editor.bindChangeEvent();

    this.vector = new VersionVector(this.siteId);
    this.crdt = new CRDT(this);
    this.editor.bindButtons();
    this.bindCopyEvent(doc);
  }

  bindCopyEvent(doc=document) {
    doc.querySelector('#copyLink').onclick = () => {
      this.copyToClipboard(doc.querySelector('#sharingLinkInput'));
    };
  }

  copyToClipboard(element) {
    const temp = document.createElement("input");
    document.querySelector("body").appendChild(temp);
    temp.value = element.textContent;
    temp.select();
    document.execCommand("copy");
    temp.remove();

    this.showCopiedStatus();
  }

  showCopiedStatus() {
    document.querySelector('.copyStatus').classList.add('copied');
    setTimeout(() => document.querySelector('.copyStatus').classList.remove('copied'), 1000);
  }

  lostConnection() {
    console.log('disconnected');
  }

  updateShareLink(id, doc=document) {
    const shareLink = this.host + '?' + id;
    const aTag = doc.querySelector('#sharingLink');
    const pTag = doc.querySelector('#sharingLinkInput');

    pTag.textContent = shareLink;
    if (navigator != null && navigator.share != null) {
      aTag.addEventListener("click", async () => {
        await navigator.share({
          title: "UML Collaboration",
          text: "Let's collaborate on a UML document",
          url: shareLink,
        });
      });
    } else {
      aTag.style.display = 'none'
    }
  }

  updatePageURL(id, win=window) {
    this.urlId = id;

    const newURL = this.host + '?' + id;
    win.history.pushState({}, '', newURL);
  }

  updateRootUrl(id, win=window) {
    if (this.urlId == 0) {
      this.updatePageURL(id, win);
    }
  }

  enableEditor(doc=document) {
    doc.getElementById('conclave').classList.remove('hide');
  }

  populateCRDT(initialStruct) {
    const struct = initialStruct.map(line => {
      return line.map(ch => {
        return new Char(ch.value, ch.counter, ch.siteId, ch.position.map(id => {
          return new Identifier(id.digit, id.siteId);
        }));
      });
    });

    this.crdt.struct = struct;
    this.editor.replaceText(this.crdt.toText());
  }

  populateVersionVector(initialVersions) {
    const versions = initialVersions.map(ver => {
      let version = new Version(ver.siteId);
      version.counter = ver.counter;
      ver.exceptions.forEach(ex => version.exceptions.push(ex));
      return version;
    });

    versions.forEach(version => this.vector.versions.push(version));
  }

  addToNetwork(peerId, siteId, doc=document) {
    if (!this.network.find(obj => obj.siteId === siteId)) {
      this.network.push({ peerId, siteId });
      if (siteId !== this.siteId) {
        this.addToListOfPeers(siteId, peerId, doc);
      }

      this.broadcast.addToNetwork(peerId, siteId);
    }
  }

  removeFromNetwork(peerId, doc=document) {
    const peerObj = this.network.find(obj => obj.peerId === peerId);
    const idx = this.network.indexOf(peerObj);
    if (idx >= 0) {
      const deletedObj = this.network.splice(idx, 1)[0];
      this.removeFromListOfPeers(peerId, doc);
      this.editor.removeCursor(deletedObj.siteId);
      this.broadcast.removeFromNetwork(peerId);
    }
  }

  makeOwnName(doc=document) {
    const listItem = doc.createElement('li');
    const node = doc.createElement('span');
    const textnode = doc.createTextNode("(You)")
    const color = generateItemFromHash(this.siteId, CSS_COLORS);
    const name = generateItemFromHash(this.siteId, ANIMALS);

    node.textContent = name;
    node.style.backgroundColor = color;
    node.classList.add('peer');

    listItem.appendChild(node);
    listItem.appendChild(textnode);
    doc.querySelector('#peerId').appendChild(listItem);
  }

  addToListOfPeers(siteId, peerId, doc=document) {
    const listItem = doc.createElement('li');
    const node = doc.createElement('span');

    const parser = new DOMParser();

    const color = generateItemFromHash(siteId, CSS_COLORS);
    const name = generateItemFromHash(siteId, ANIMALS);

    node.textContent = name;
    node.style.backgroundColor = color;
    node.classList.add('peer');

    listItem.id = peerId;
    listItem.appendChild(node);
    doc.querySelector('#peerId').appendChild(listItem);
  }

  getPeerElemById(peerId, doc=document) {
    return doc.getElementById(peerId);
  }

  getPeerFlagById(peerId, doc=document) {
    const peerLi = doc.getElementById(peerId);
    return peerLi.children[0];
  }

  removeFromListOfPeers(peerId, doc=document) {
    doc.getElementById(peerId).remove();
  }

  findNewTarget() {
    const connected = this.broadcast.outConns.map(conn => conn.peer);
    const unconnected = this.network.filter(obj => {
      return connected.indexOf(obj.peerId) === -1;
    });

    const possibleTargets = unconnected.filter(obj => {
      return obj.peerId !== this.broadcast.peer.id
    });

    if (possibleTargets.length === 0) {
      this.broadcast.peer.on('connection', conn => this.updatePageURL(conn.peer));
    } else {
      const randomIdx = Math.floor(Math.random() * possibleTargets.length);
      const newTarget = possibleTargets[randomIdx].peerId;
      this.broadcast.requestConnection(newTarget, this.broadcast.peer.id, this.siteId);
    }
  }

  handleSync(syncObj, doc=document, win=window) {
    if (syncObj.peerId != this.urlId) { this.updatePageURL(syncObj.peerId, win); }

    syncObj.network.forEach(obj => this.addToNetwork(obj.peerId, obj.siteId, doc));

    if (this.crdt.totalChars() === 0) {
      this.populateCRDT(syncObj.initialStruct);
      this.populateVersionVector(syncObj.initialVersions);
    }
    this.enableEditor(doc);

    this.syncCompleted(syncObj.peerId);
  }

  syncCompleted(peerId) {
    const completedMessage = JSON.stringify({
      type: 'syncCompleted',
      peerId: this.broadcast.peer.id
    });

    let connection = this.broadcast.outConns.find(conn => conn.peer === peerId);

    if (connection) {
      connection.send(completedMessage);
    } else {
      connection = this.broadcast.peer.connect(peerId);
      this.broadcast.addToOutConns(connection);
      connection.on('open', () => {
        connection.send(completedMessage);
      });
    }
  }

  handleRemoteOperation(operation) {
    if (this.vector.hasBeenApplied(operation.version)) return;

    if (operation.type === 'insert') {
      this.applyOperation(operation);
    } else if (operation.type === 'delete') {
      this.buffer.push(operation);
    }

    this.processDeletionBuffer();
    this.broadcast.send(operation);
  }

  processDeletionBuffer() {
    let i = 0;
    let deleteOperation;

    while (i < this.buffer.length) {
      deleteOperation = this.buffer[i];

      if (this.hasInsertionBeenApplied(deleteOperation)) {
        this.applyOperation(deleteOperation);
        this.buffer.splice(i, 1);
      } else {
        i++;
      }
    }
  }

  hasInsertionBeenApplied(operation) {
    const charVersion = { siteId: operation.char.siteId, counter: operation.char.counter };
    return this.vector.hasBeenApplied(charVersion);
  }

  applyOperation(operation) {
    const char = operation.char;
    const identifiers = char.position.map(pos => new Identifier(pos.digit, pos.siteId));
    const newChar = new Char(char.value, char.counter, char.siteId, identifiers);

    if (operation.type === 'insert') {
      this.crdt.handleRemoteInsert(newChar);
    } else if (operation.type === 'delete') {
      this.crdt.handleRemoteDelete(newChar, operation.version.siteId);
    }

    this.vector.update(operation.version);
  }

  localDelete(startPos, endPos) {
    this.crdt.handleLocalDelete(startPos, endPos);
  }

  localInsert(chars, startPos) {
    for (let i = 0; i < chars.length; i++) {
      if (chars[i - 1] === '\n') {
        startPos.line++;
        startPos.ch = 0;
      }
      this.crdt.handleLocalInsert(chars[i], startPos);
      startPos.ch++;
    }
  }

  broadcastInsertion(char) {
    const operation = {
      type: 'insert',
      char: char,
      version: this.vector.getLocalVersion()
    };

    this.broadcast.send(operation);
  }

  broadcastDeletion(char, version) {
    const operation = {
      type: 'delete',
      char: char,
      version: version
    };

    this.broadcast.send(operation);
  }

  insertIntoEditor(value, pos, siteId) {
    const positions = {
      from: {
        line: pos.line,
        ch: pos.ch,
      },
      to: {
        line: pos.line,
        ch: pos.ch,
      }
    }

    this.editor.insertText(value, positions, siteId);
  }

  deleteFromEditor(value, pos, siteId) {
    let positions;

    if (value === "\n") {
      positions = {
        from: {
          line: pos.line,
          ch: pos.ch,
        },
        to: {
          line: pos.line + 1,
          ch: 0,
        }
      }
    } else {
      positions = {
        from: {
          line: pos.line,
          ch: pos.ch,
        },
        to: {
          line: pos.line,
          ch: pos.ch + 1,
        }
      }
    }

    this.editor.deleteText(value, positions, siteId);
  }
}

export default Controller;
