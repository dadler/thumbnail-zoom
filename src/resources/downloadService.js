/**
 * Copyright (c) 2010 Andres Hernandez Monge and 
 * Copyright (c) 2011-2012 David M. Adler
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

"use strict";

var EXPORTED_SYMBOLS = [];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource://thumbnailzoomplus/common.js");

try {
  Cu.import("resource://gre/modules/PrivateBrowsingUtils.jsm");
} catch (e) {
  // old Firefox versions (e.g. 3.6) didn't have PrivateBrowsingUtils.
}

/**
 * The Download Service.
 */
ThumbnailZoomPlus.DownloadService = {
  /* Logger for this object. */
  _logger : null,
  
  /**
   * Initializes the resource.
   */
  _init : function() {
    this._logger = ThumbnailZoomPlus.getLogger("ThumbnailZoomPlus.DownloadService");
    this._logger.trace("_init");
  },

  /**
   * Dowloads an image.
   * @param aImage the image.
   * @param aFilePath the destination file path.
   * @param aWin the window.
   */
  downloadImageAsOriginal : function(win, imageURL, aFilePath) {
    this._logger.debug("downloadImageAsOriginal(" + win + ", " + imageURL + "," + aFilePath + ")");

    /*
       Note that uploading to the Mozilla add-ons site after approx. 9/24/2012
       causes this warning from the site:
       
         `nsILocalFile` should be replaced with `nsIFile`.
         Warning: Starting with Gecko 14, `nsILocalFile` inherits all functions 
         and attributes from `nsIFile`, meaning that you no longer need to use 
         `nsILocalFile`. If your add-on doesn't support versions older than 14,
         you should use `nsIFile` instead of `nsILocalFile`.
         Warning: See bug https://bugzilla.mozilla.org/show_bug.cgi?id=682360 
         for more information.
         
       As far as I can tell it's OK to leave the code as-is and ignore the
       warning since we support back to version 3.x of Firefox.
     */
    let file = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsILocalFile);
    file.initWithPath(aFilePath);
    this._saveImage(win, imageURL, file);
  },

  /**
   * Saves an image locally.
   * @param aData the canvas data.
   * @param aFile the destination file.
   */
  _saveImage : function(win, imageURL, aFile) {
    this._logger.trace("_saveImage");

    let ioService =
      Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);
    let persist =
      Cc["@mozilla.org/embedding/browser/nsWebBrowserPersist;1"].
        createInstance(Ci.nsIWebBrowserPersist);
    let source = ioService.newURI(imageURL, "UTF8", null);
    let target = ioService.newFileURI(aFile);

    if (win && "undefined" != typeof(PrivateBrowsingUtils) &&
        PrivateBrowsingUtils.privacyContextFromWindow) {
      var privacyContext = PrivateBrowsingUtils.privacyContextFromWindow(win);
      var isPrivate = privacyContext.usePrivateBrowsing;
    } else {
      // older than Firefox 19 or couldn't get window.
      var privacyContext = null;
      var isPrivate = false;
    }
      
    this._logger.debug("_saveImage: privacyContext=" + privacyContext + "; isPrivate=" + isPrivate);

    // set persist flags
    persist.persistFlags =
      (Ci.nsIWebBrowserPersist.PERSIST_FLAGS_REPLACE_EXISTING_FILES |
       Ci.nsIWebBrowserPersist.PERSIST_FLAGS_AUTODETECT_APPLY_CONVERSION);

    // Create a 'transfer' object and set it as the progress listener.
    // This causes the downloaded image to appear in the Firefox
    // "Downloads" dialog.
    let transfer = Cc["@mozilla.org/transfer;1"].createInstance(Ci.nsITransfer);
    transfer.init(source, target, "", null, null, null, persist, isPrivate);
    persist.progressListener = transfer;
    
    /*
       Note: the mozilla add-on validator warns below:
         `saveURI` has been changed.
         Warning: The `saveURI` function have changed to support per-window 
         private browsing. You should now pass a context as an additional 
         argument.
         See bug https://bugzilla.mozilla.org/show_bug.cgi?id=794602 for more 
         information.
       As far as I can tell the warning is spurious since we *are* passing
       in privacyContext.
     */
     
    // save image to the file
    // short-term version compatibility: Firefox 36 added another argument
    // to saveURI.  Try old format first, but if we get an exception try the new
    // one.
    // Better fix would be to use Downloads.createDownload) instead
    // https://developer.mozilla.org/en-US/docs/Mozilla/JavaScript_code_modules/Downloads.jsm#createDownload%28%29
    // but that's not available in firefox older than 26.
    // See #198: https://github.com/dadler/thumbnail-zoom/issues/198
    try {
      // ff older than 36.
      persist.saveURI(source, null, null, null, null, aFile, privacyContext);
    } catch (exc) {
      persist.saveURI(source, null, null, null, null, 0, aFile, privacyContext);
    }
  }
  
};

/**
 * Constructor.
 */
(function() { this._init(); }).apply(ThumbnailZoomPlus.DownloadService);
