/**
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

/*
 * pagesIndirect.js: this module defines utility routines for the
 * rule Pages.OthersIndirect.  This module contains only functionality
 * which is generic to all sites; site-specific rules are in pages.js.
 */
 
"use strict";

var EXPORTED_SYMBOLS = [];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource://thumbnailzoomplus/common.js");

/**
 * Pages namespace
 */
ThumbnailZoomPlus.PagesIndirect = {
  /* Logger for this object. */
  _logger : null,

  /**
   * Initializes the resource.
   */
  _init : function() {
    this._logger = ThumbnailZoomPlus.getLogger("ThumbnailZoomPlus.PagesIndirect");
    this._logger.trace("_init");
  },
  
  // parseHtmlDoc parses the specified html string and returns
  // a result object with result.doc and result.body set.
  parseHtmlDoc : function(doc, pageUrl, aHTMLString) {
    this._logger.debug("parseHtmlDoc: Building doc");
    
    var tempdoc = doc.implementation.createDocument("http://www.w3.org/1999/xhtml", "html", null);

    var head = tempdoc.createElementNS("http://www.w3.org/1999/xhtml", "head");
    tempdoc.documentElement.appendChild(head);
    var base = tempdoc.createElementNS("http://www.w3.org/1999/xhtml", "base");
    base.href = pageUrl;
    head.appendChild(base);
    
    var body = tempdoc.createElementNS("http://www.w3.org/1999/xhtml", "body");
    tempdoc.documentElement.appendChild(body);

    this._logger.debug("parseHtmlDoc: parsing html fragment");
    let tree = 
      Components.classes["@mozilla.org/feed-unescapehtml;1"]
      .getService(Components.interfaces.nsIScriptableUnescapeHTML)
      .parseFragment(aHTMLString, false, null, body);

    this._logger.debug("parseHtmlDoc: inserting tree into doc");
    body.appendChild(tree);

    // this._logger.debug("\n\n\n\nDOC tree:\n" + body.outerHTML + "\n\n\n\n");
    
    return {'doc': tempdoc, 'body': body};
  },


  getImgFromSelectors : function(body, selectors) {
    for (var i in selectors) {
      var selector = selectors[i];
      this._logger.debug("  Seeking with selector '" + selector + "'");
      let node = null;
      try {
        node = body.querySelector(selector);
      } catch (e) {
        ThumbnailZoomPlus._logExceptionToConsole("getImgFromSelectors", e);
      }
      if (node != null) {
        /*
           Get URL from <img src=>, <a href=>
         */
        let src = node.getAttribute("src") || node.getAttribute("href");
        this._logger.debug("  Found node " + node.localName + " url " + src);
        return src;
      }
    }
    return null;
  },
  

  /**
   * _getImageFromLinkedPageGen is a generator which reads the html doc
   * at specified pageUrl and calls pageCompletionFunc when it has determined
   * the appropriate image URL.  It operates asynchronously (and thus can call
   * pageCompletionFunc after it returns).  Each yield of the generator 
   * corresponds to an update of the html page's loading.  The generator is
   * created and invoked from getImageFromLinkedPage().
   */
  _getImageFromLinkedPageGen : function(doc, pageUrl, flags, invocationNumber,
                                           pageCompletionFunc,
                                           getImageFromHtmlFunc)
  {
    this._logger.debug("_getImageFromLinkedPageGen for " + pageUrl +
                 " invocationNumber " + invocationNumber);

    // The first call to generator.send() passes in the generator itself.
    let generator = yield undefined;
    
    let req = Components.classes["@mozilla.org/xmlextras/xmlhttprequest;1"].createInstance();

    // Call the generator's next() function whenever readystate is updated.
    req.onreadystatechange = function() {
      if (req.readyState >= req.HEADERS_RECEIVED) {
        try {
          if (generator) {
              generator.next();
          }
        } catch (e if e instanceof StopIteration) {
          // normal completion of generator.
        } catch (e) {
          ThumbnailZoomPlus._logExceptionToConsole("_getImageFromLinkedPageGen", e);
        }

      }
    };

    // req.responseType = "document";
    // req.timeout = 5000; // 5-second timeout (not supported for synchronous call)
    let asynchronous = true;
    req.open('GET', pageUrl, asynchronous);
    req.setRequestHeader('Accept', 'text/html');
    req.send();

    // Wait for headers to be available.
    this._logger.debug("_getImageFromLinkedPageGen: waiting for headers");
    yield undefined;
    
    if (invocationNumber != ThumbnailZoomPlus.Pages.OthersIndirect.invocationNumber) {
      // This request is obsolete.
      this._logger.debug("_getImageFromLinkedPageGen: aborting obsolete request.");
      // we don't abort since it causes 'already executing generator' error in generator.next() call above:
      // disabled: req.abort();
      generator = null;
      return;
    }
    
    if (req.status != 200) {
      // error from site
      this._logger.debug("_getImageFromLinkedPageGen: site returned error " + req.statusText);
      pageCompletionFunc(null);
    }

    // Check the doc type so we don't e.g. try to parse an image as if it were html.
    let docType = req.getResponseHeader('Content-Type');
    if (! /text\/html/.test(docType)) {
      this._logger.debug("_getImageFromLinkedPageGen: unsupported doc type returned: " + docType);
      pageCompletionFunc(null);
    }

    // Wait for content to be done loading.
    while (req.readyState < req.DONE) {
      this._logger.debug("_getImageFromLinkedPageGen: waiting for body; readyState=" + req.readyState);
      this._logger.debug("_getImageFromLinkedPageGen:   invocationNumber=" + invocationNumber + 
                   "; this.invocationNumber=" + ThumbnailZoomPlus.Pages.OthersIndirect.invocationNumber);
      yield undefined;
      if (invocationNumber != ThumbnailZoomPlus.Pages.OthersIndirect.invocationNumber) {
        // This request is obsolete.
        this._logger.debug("_getImageFromLinkedPageGen: aborting obsolete request.");
        // we don't abort since it causes 'already executing generator' error in generator.next() call above:
        // disabled: req.abort();
        generator = null;
        return;
      }
    }
    
    var aHTMLString = req.responseText;
    if (! aHTMLString) {
      this._logger.debug("_getImageFromLinkedPageGen: site returned empty/null text " + aHTMLString);
      pageCompletionFunc(null);
    }
    // parseFragment won't run javascript so we need to not ignore the contents
    // of <noscript> tags.  Remove them.
    aHTMLString = aHTMLString.replace(/\<\/?noscript.*\>/ig, "");
    this._logger.debug("  Got doc type " + docType + ":" + aHTMLString);
    
    let url = getImageFromHtmlFunc(doc, pageUrl, flags, aHTMLString);
    
    pageCompletionFunc(url);
  },


  // getImageFromLinkedPage returns the URL of an image determined by analyzing
  // the html at the specified URL.  
  // getImageFromHtmlFunc() is supplied by the caller, and is called as:
  //   getImageFromHtmlFunc(doc, pageUrl,aHTMLString).
  getImageFromLinkedPage : function(doc, pageUrl, flags, invocationNumber, pageCompletionFunc,
                                    getImageFromHtmlFunc)
  {
    try {
      let generator = this._getImageFromLinkedPageGen(doc, pageUrl, flags, invocationNumber, 
                                                pageCompletionFunc, 
                                                getImageFromHtmlFunc);
      
      // start the generator.
      generator.next();
      generator.send(generator);
    } catch (e) {
      ThumbnailZoomPlus._logExceptionToConsole("getImageFromLinkedPage", e);
    }
    
    return "deferred";
  }

};

/**
 * Constructor.
 */
(function() { this._init(); }).apply(ThumbnailZoomPlus.PagesIndirect);
