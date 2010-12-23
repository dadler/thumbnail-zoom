/**
 * Copyright (c) 2010 Andres Hernandez Monge
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions
 * are met:
 * 1. Redistributions of source code must retain the above copyright
 *    notice, this list of conditions and the following disclaimer.
 * 2. Redistributions in binary form must reproduce the above copyright
 *    notice, this list of conditions and the following disclaimer in the
 *    documentation and/or other materials provided with the distribution.
 * 3. Neither the name of copyright holders nor the names of its
 *    contributors may be used to endorse or promote products derived
 *    from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
 * "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED
 * TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR
 * PURPOSE ARE DISCLAIMED.  IN NO EVENT SHALL COPYRIGHT HOLDERS OR CONTRIBUTORS
 * BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
 * CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
 * SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
 * INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
 * CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
 * ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
 * POSSIBILITY OF SUCH DAMAGE.
 */

var EXPORTED_SYMBOLS = [];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource://imagezoom/common.js");

/**
 * The Download Service.
 */
ImageZoom.DownloadService = {
  /* Logger for this object. */
  _logger : null,

  /**
   * Initializes the resource.
   */
  _init : function() {
    this._logger = ImageZoom.getLogger("ImageZoom.DownloadService");
    this._logger.trace("_init");
  },

  /**
   * Dowloads an image.
   * @param aImage the image.
   * @param aFilePath the destination file path.
   * @param aWin the window.
   */
  downloadImage : function(aImage, aFilePath, aWin) {
    this._logger.debug("downloadImage");

    let file = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsILocalFile);
    let canvas =
      aWin.document.createElementNS("http://www.w3.org/1999/xhtml", "canvas");
    let canvasCtx = canvas.getContext('2d');
    let data = null;

    canvas.width = aImage.width;
    canvas.height = aImage.height;
    canvasCtx.drawImage(aImage, 0, 0);
    data = canvas.toDataURL("image/png", "");
    file.initWithPath(aFilePath);

    this._saveImage(data, file);
  },

  /**
   * Saves an image locally.
   * @param aData the canvas data.
   * @param aFile the destination file.
   */
  _saveImage : function(aData, aFile) {
    this._logger.trace("_saveImage");

    let ioService =
      Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);
    let persist =
      Cc["@mozilla.org/embedding/browser/nsWebBrowserPersist;1"].
        createInstance(Ci.nsIWebBrowserPersist);
    let transfer = Cc["@mozilla.org/transfer;1"].createInstance(Ci.nsITransfer);
    let source = ioService.newURI(aData, "UTF8", null);
    let target = ioService.newFileURI(aFile);

    // set persist flags
    persist.persistFlags =
      (Ci.nsIWebBrowserPersist.PERSIST_FLAGS_REPLACE_EXISTING_FILES |
       Ci.nsIWebBrowserPersist.PERSIST_FLAGS_AUTODETECT_APPLY_CONVERSION);
    // displays a download dialog
    transfer.init(source, target, "", null, null, null, persist);
    persist.progressListener = transfer;
    // save the canvas data to the file
    persist.saveURI(source, null, null, null, null, aFile);
  }
};

/**
 * Constructor.
 */
(function() { this._init(); }).apply(ImageZoom.DownloadService);
