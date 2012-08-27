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
  
  _imageBeingCopied : null,
  
  /**
   * Initializes the resource.
   */
  _init : function() {
    this._logger = ThumbnailZoomPlus.getLogger("ThumbnailZoomPlus.ClipboardService");
    this._logger.trace("_init");
  },

  _goDoCommand : function(doc, aCommand) {
    // copied from chrome://global/content/globalOverlay.js
    try {
      var controller = doc.commandDispatcher
        .getControllerForCommand(aCommand);
      if (controller && controller.isCommandEnabled(aCommand))
        controller.doCommand(aCommand);
    }
    catch (e) {
      Components.utils.reportError("An error occurred executing the " +
                                   aCommand + " command: " + e);
      this._logger.debug("Error running comand " + aCommand + ": " + e);
    }
  },
  
  /**
   * copies the specified image URL and/or the image contents it represents
   * to the clipboard.
   * win is an XUL window (not the html window).
   */
  copyImageToClipboard : function(win, imageURL, copyImage, copyImageURL) {
  /*
     It's hard to find documentation about how to copy an image to the clipcboard
     in Firefox.  Here are some helpful links:
     https://developer.mozilla.org/en-US/docs/Using_the_Clipboard
     https://forums.mozilla.org/addons/viewtopic.php?p=20877&sid=15a46a06940d3f697ee04dc34766241b (eg using goDoCommand)
     https://bugzilla.mozilla.org/show_bug.cgi?id=750108#c17
     http://mxr.mozilla.org/mozilla-central/source/widget/gtk2/nsClipboard.cpp#573
     http://mxr.mozilla.org/mozilla-central/source/content/base/src/nsCopySupport.cpp#530 (see ImageCopy)
     http://mxr.mozilla.org/mozilla-central/source/widget/nsITransferable.idl#19
     http://mxr.mozilla.org/mozilla-central/source/widget/xpwidgets/nsTransferable.cpp (see setTransferData)
     http://doxygen.db48x.net/mozilla/html/classnsContentUtils.html#a68c806cfbde4041e999c9471ede0d6ee (see getContentFromImage)
     http://stackoverflow.com/questions/6365550/xul-xpcom-copy-image-from-string-to-clipboard
     http://mxr.mozilla.org/mozilla-release/source/image/src/imgTools.cpp
     http://mxr.mozilla.org/mozilla-release/source/image/src/RasterImage.cpp
     http://mxr.mozilla.org/mozilla-central/source/widget/cocoa/nsClipboard.mm
     https://github.com/ehsan/mozilla-history/blob/master/content/base/src/nsContentUtils.cpp
   */
    this._logger.debug("copyImageToClipboard: " + imageURL + ", copyImage=" + copyImage + 
                       ", copyImageURL=" + copyImageURL);
    
    // var imagedata = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAABGdBTUEAALGPC/xhBQAAAAlwSFlzAAALEwAACxMBAJqcGAAAAAd0SU1FB9YGARc5KB0XV+IAAAAddEVYdENvbW1lbnQAQ3JlYXRlZCB3aXRoIFRoZSBHSU1Q72QlbgAAAF1JREFUGNO9zL0NglAAxPEfdLTs4BZM4DIO4C7OwQg2JoQ9LE1exdlYvBBeZ7jqch9//q1uH4TLzw4d6+ErXMMcXuHWxId3KOETnnXXV6MJpcq2MLaI97CER3N0vr4MkhoXe0rZigAAAABJRU5ErkJggg==';
    var ioSvc     = Components.classes["@mozilla.org/network/io-service;1"].getService(Components.interfaces.nsIIOService);
    var trans     = Components.classes["@mozilla.org/widget/transferable;1"].createInstance(Components.interfaces.nsITransferable);
    if (copyImage) {
    
      if (false) {
        // Alternate approach, but which doesn't let us include html favor.
        
        // this._imageBeingCopied = win.document.createElement("image");
        // this._imageBeingCopied = new win.Image();
        this._imageBeingCopied = win.document.createElementNS("http://www.w3.org/1999/xhtml", "img");
        let that = this;
        this._imageBeingCopied.onload = function() {
          that._logger.debug("copyImageToClipboard onload: copying to clipboard");
          var node = win.document.popupNode;
          that._logger.debug("copyImageToClipboard onload 2: copying to clipboard");
          win.document.popupNode = that._imageBeingCopied;
          that._logger.debug("copyImageToClipboard onload 3: copying to clipboard.");
          that._goDoCommand(win.document, "cmd_copyImage");
          that._logger.debug("copyImageToClipboard onload 4: copying to clipboard");
          win.document.popupNode = node;
          that._logger.debug("copyImageToClipboard onload: copied to clipboard");
          that._imageBeingCopied = null;
        };
        this._imageBeingCopied.onerror = function() {
          that._logger.debug("copyImageToClipboard onerror");
          that._imageBeingCopied = null;
        }
        
        this._imageBeingCopied.src = imageURL;
        this._logger.debug("copyImageToClipboard: submitted to image for load and then copy; image=" + this._imageBeingCopied);
        
        return;
      }
    
    
    
      /**
       * Put the image on the clipboard
       */
      var imgToolsSvc = Components.classes["@mozilla.org/image/tools;1"].getService(Components.interfaces.imgITools);
      var channel     = ioSvc.newChannel(imageURL, null, null);
      var input       = channel.open();
      
      var detectedType = channel.contentType;
      if (detectedType == "image/jpeg") {
        // Firefox seems to tag jpg images as image/jpeg, but clients such as
        // Photoshop (OSX) and Thunderbird (OSX) don't seem to accept image/jpeg,
        // but they do accept image/jpg in he transferable's flavor, so use jpg instead.
        detectedType = "image/jpg";
      }
      
      /*
       * Sites don't always tag imags with the correct mime type, so we 
       * try first the claimed type but if that fails to convert we try other
       * image types.
       */
      var mimes = [detectedType, "image/gif", "image/png", "image/jpg"];
      
      for (var i = 0; i < mimes.length; i++) {
        channel.contentType = mimes[i];
        if (i > 0 && channel.contentType == mimes[0]) {
          // already tried this one.
          continue;
        }
        if (channel.contentType == "text/html" || channel.contentType == "text/plain") {
          // the mimie type was mistagged, and couldn't possibly parse into an image with
          // that type.  Skip it.
          continue;
        }
        this._logger.debug("copyImageToClipboard: channel=" + 
                           channel + "; channel.contentType=" + channel.contentType);
        
        var container  = {};
        try {
          imgToolsSvc.decodeImageData(input, channel.contentType, container);
          this._logger.debug("copyImageToClipboard: succeeded with type " + channel.contentType);
          break;
        } catch (e) {
          // We can get an exception if the mime type is wrong.
          this._logger.debug("copyImageToClipboard: caught exception: " + e);
        }
        
        // We need to re-read the image to try a different mimetype.  Close the
        // stream and re-open the channel to get a new stream.
        input.close();
        channel = ioSvc.newChannel(imageURL, null, null);
        input = channel.open();
      }
      
      this._logger.debug("copyImageToClipboard: container=" + container +
                         "; container.value=" + container.value +
                         "; contentLength=" + channel.contentLength);

      if (! container.value) {
        return;
      }
      
      var wrapped = Components.classes["@mozilla.org/supports-interface-pointer;1"].createInstance(Components.interfaces.nsISupportsInterfacePointer);
      wrapped.data = container.value;
      
      this._logger.debug("copyImageToClipboard: wrapped=" + wrapped);
      
      var flavor = channel.contentType;
      trans.addDataFlavor(flavor);
      trans.setTransferData(flavor, wrapped, channel.contentLength);
      
      /*
       * Also put the image's html <img> tag on the clipboard.  This is 
       * important (at least on OSX): if we copy just jpg image data,
       * programs like Photoshop and Thunderbird seem to receive it as
       * uncompressed png data, which is very large, bloating emails and
       * causing randomly truncated data.  But if we also include a
       * text/html flavor referring to the jpg image on the Internet, 
       * those programs retrieve the image directly as the original jpg
       * data, so there is no data bloat.
       */
      var str = Components.classes["@mozilla.org/supports-string;1"].createInstance(Ci.nsISupportsString);
      if (str) {
        
        str.data = "<img src=\"" + imageURL + "\" />";
        trans.addDataFlavor("text/html");
        trans.setTransferData("text/html", str, str.data.length * 2);
      }      

    }
    
    if (copyImageURL) {
      /*
       * Put the URL on the clipboard as plain text.
       */
      var str = Components.classes["@mozilla.org/supports-string;1"].createInstance(Ci.nsISupportsString);
      if (str) {
        
        str.data = imageURL;
        
        trans.addDataFlavor("text/unicode");
        trans.setTransferData("text/unicode", str, str.data.length * 2);
      }      
    }
    var clipid = Components.interfaces.nsIClipboard;
    var clip   = Components.classes["@mozilla.org/widget/clipboard;1"].getService(clipid);
    clip.setData(trans, null, clipid.kGlobalClipboard);
  }
  
};

/**
 * Constructor.
 */
(function() { this._init(); }).apply(ThumbnailZoomPlus.ClipboardService);
