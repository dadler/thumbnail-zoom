/**
 * Copyright (c) 2012 David M. Adler
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

/**
 * The Clipboard Service.
 */
ThumbnailZoomPlus.ClipboardService = {
  /* Logger for this object. */
  _logger : null,
  
  /**
   * Initializes the resource.
   */
  _init : function() {
    this._logger = ThumbnailZoomPlus.getLogger("ThumbnailZoomPlus.ClipboardService");
    this._logger.trace("_init");
  },

  /**
   * Dowloads an image.
   * @param aImage the image.
   * @param aFilePath the destination file path.
   * @param aWin the window.
   */
  copyImageToClipboard : function(image) {
    this._logger.debug("copyImageToClipboard");
    
    var copytext = "Text to copy";
    
    var str = Cc["@mozilla.org/supports-string;1"].
    createInstance(Ci.nsISupportsString);
    if (!str) return false;
    
    str.data = copytext;
    
    var trans = Cc["@mozilla.org/widget/transferable;1"].
    createInstance(Ci.nsITransferable);
    if (!trans) return false;
    
    trans.addDataFlavor("text/unicode");
    trans.setTransferData("text/unicode", str, copytext.length * 2);
    
    var clipid = Ci.nsIClipboard;
    var clip = Cc["@mozilla.org/widget/clipboard;1"].getService(clipid);
    if (!clip) return false;
    
    clip.setData(trans, null, clipid.kGlobalClipboard);  }
};

/**
 * Constructor.
 */
(function() { this._init(); }).apply(ThumbnailZoomPlus.ClipboardService);
