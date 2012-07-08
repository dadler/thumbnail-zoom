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

var ThumbnailZoomPlusOptions = {

    _logger :  ThumbnailZoomPlus.getLogger("ThumbnailZoomPlusOptions"),
    _consoleService : Cc["@mozilla.org/consoleservice;1"].
                                   getService(Ci.nsIConsoleService),
    _clipboardHelper : Components.classes["@mozilla.org/widget/clipboardhelper;1"].  
                           getService(Components.interfaces.nsIClipboardHelper),

    /**
     * Copy console messages to clipboard.
     */
    copyDebugLog : function() {
      this._logger.trace("copyDebugLog");
      
      let messages = {};
      let count = {};
      this._consoleService.getMessageArray(messages, count);

      let log = "";
      for (var i in messages.value) {
        let msg = messages.value[i];
      if (msg instanceof Ci.nsIScriptError) {
        let timeStamp = new Date(msg.timeStamp).toLocaleTimeString() + 
                        String((msg.timeStamp % 1000) / 1000.).replace(/^0\./, ".");
        var severity = "";
        if (msg.flags & msg.warningFlag) {
          severity += "W";
        } else if (msg.flags & msg.exceptionFlag) {
          severity += "X";
        } else if (msg.flags & msg.strictFlag) {
          severity += "S";
        } else {
          severity += "E";
        }
        var text = timeStamp + " " + severity + " " + msg.category.replace(" ", "_") +
                   ": " + msg.message
      } else {
        var text = ": " + msg.message;
      }
        log += "=== " + text + "\n";
      }
      this._logger.debug("copyDebugLog: message=" + log);
      
      this._clipboardHelper.copyString(log);  
    }
};
