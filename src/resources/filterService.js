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

"use strict";

var EXPORTED_SYMBOLS = [];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource://thumbnailzoomplus/common.js");

/**
 * The Filter Service.
 */
ThumbnailZoomPlus.FilterService = {
  /* Pages info list. */
  pageList : [
    ThumbnailZoomPlus.Pages.Amazon, // 0
    ThumbnailZoomPlus.Pages.DailyMile,
    ThumbnailZoomPlus.Pages.DeviantART,
    ThumbnailZoomPlus.Pages.Engadget,
    ThumbnailZoomPlus.Pages.Facebook,
    ThumbnailZoomPlus.Pages.Flickr, // 5
    ThumbnailZoomPlus.Pages.GMail, // before Google so it takes priority.
    ThumbnailZoomPlus.Pages.GooglePlus, // before Google so it takes priority.
    ThumbnailZoomPlus.Pages.Google,
    ThumbnailZoomPlus.Pages.Hi5,
    ThumbnailZoomPlus.Pages.IMDb,
    ThumbnailZoomPlus.Pages.Imgur, // 11
    ThumbnailZoomPlus.Pages.LastFM,
    ThumbnailZoomPlus.Pages.LinkedIn,
    ThumbnailZoomPlus.Pages.MySpace,
    ThumbnailZoomPlus.Pages.PhotoBucket,
    ThumbnailZoomPlus.Pages.Photosight, // 16
    ThumbnailZoomPlus.Pages.Picasa,
    ThumbnailZoomPlus.Pages.Tagged,
    ThumbnailZoomPlus.Pages.Twitpic,
    ThumbnailZoomPlus.Pages.Twitter,
    ThumbnailZoomPlus.Pages.YouTube, // 21
    ThumbnailZoomPlus.Pages.Wikipedia,
    ThumbnailZoomPlus.Pages.Others // last; lowest priority
  ],

  /* Logger for this object. */
  _logger : null,

  /**
   * Initializes the resource.
   */
  _init : function() {
    this._logger = ThumbnailZoomPlus.getLogger("ThumbnailZoomPlus.FilterService");
    this._logger.trace("_init");
  },

  /**
   * Detects and gets the page constant.
   * @param aDocument the document object.
   * @return the page constant.
   *
   * TODO: perhaps we should change this to use the URI of the
   * thumb / link being evaluated (dynamically) instead of
   * the URI of the document itself.
   */
  getPageConstantByDoc : function(aDocument, startFromPage) {
    // If enableFileProtocol, then the add-on is enabled for file:// URLs
    // (typically used with the Others page type).  This is useful during
    // debugging, but we don't normally enable it in the released version
    // since we aren't sure if there might be subtle security risks.
    let enableFileProtocol = false;

    let pageConstant = -1;
    let name = "?";
    
    if (aDocument.location &&
        ("http:" == aDocument.location.protocol ||
         "https:" == aDocument.location.protocol ||
         (enableFileProtocol && "file:" == aDocument.location.protocol))) {
      let host = aDocument.location.host;
      let pageCount = this.pageList.length;

      for (let i = startFromPage; i < pageCount; i++) {
        let hostRegExp = new RegExp(this.pageList[i].host);
        if (hostRegExp.test(host)) {
          pageConstant = i;
          name = this.pageList[i].key;
          break;
        }
      }
    }

    this._logger.debug("getPageConstantByDoc: Found '" +
                       name + "' (" + pageConstant + ") for " + aDocument.location + // " host " + 
                       //aDocument.location.host +
                       (pageConstant < 0 ? "" : 
                       (" based on regexp " + this.pageList[pageConstant].host)) );

    return pageConstant;
  },

  /**
   * Gets the page constant by name.
   * @param aPageName the page name.
   * @return the page constant.
   */
  getPageConstantByName : function(aPageName) {
    this._logger.debug("getPageConstantByName");

    let pageCount = this.pageList.length;
    let pageConstant = -1;

    for (let i = 0; i < pageCount; i++) {
      if (this.pageList[i].key == aPageName) {
        pageConstant = i;
        break;
      }
    }

    return pageConstant;
  },

  /**
   * Gets the page name.
   * @param aPageConstant the page constant.
   * @return the page constant name.
   */
  getPageName : function(aPageConstant) {
    this._logger.debug("getPageName");

    return this.pageList[aPageConstant].key;
  },

  /**
   * Verify if the page is enabled.
   * @param aPage the page constant.
   * @return true if the page is enabled, false otherwise.
   */
  isPageEnabled : function(aPage) {
    this._logger.debug("isPageEnabled " + aPage);

    let pageEnable = false;
    let pageName = this.getPageName(aPage);

    if (null != pageName) {
      pageEnable = ThumbnailZoomPlus.isNamedPageEnabled(pageName);
    }

    return pageEnable;
  },

  /**
   * Toggles the value of the page if enabled.
   * @param aPage the page constant.
   */
  togglePageEnable : function(aPage) {
    this._logger.debug("togglePageEnable " + aPage);

    let pageName = this.getPageName(aPage);

    if (null != pageName) {
      let pagePrefKey = ThumbnailZoomPlus.PrefBranch + pageName + ".enable";
      let pageEnable = ThumbnailZoomPlus.Application.prefs.get(pagePrefKey).value;

      ThumbnailZoomPlus.Application.prefs.setValue(pagePrefKey, !pageEnable);
    }
  },

  _applyBaseURI : function(aDocument, url) {
    var ioService = Components.classes["@mozilla.org/network/io-service;1"]  
                      .getService(Components.interfaces.nsIIOService);
    var baseUri = ioService.newURI(aDocument.baseURI, aDocument.characterSet, null);
    var uri = ioService.newURI(url, aDocument.characterSet, baseUri);
    return uri.spec;
  },
  
  /**
   * Gets the image source, handle special cases.
   * @param aNode the html node.
   * @param aPage the page constant.
   * @return object with fields:
   *     imageURL: string (null if not apply);
   *     noTooSmallWarning: boolean
   */
  getImageSource : function(aDocument, aNode, aPage, forceUseImgNode) {
    let result = {imageURL: null, noTooSmallWarning: false};
    let pageInfo = this.pageList[aPage];
    this._logger.debug("getImageSource: page " + aPage + " " + pageInfo.key + 
                       ", forceUseImgNode=" + forceUseImgNode);

    let nodeName = aNode.localName.toLowerCase();
    this._logger.debug("getImageSource: node name: " + nodeName + "; src: " +
                       aNode.getAttribute("src") + "; href: " + aNode.getAttribute("href"));
    let imageSource =  null;
    let imgImageSource = null;
    if ("img" == nodeName) {
      imageSource = aNode.getAttribute("src");
      imageSource = this._applyBaseURI(aDocument, imageSource);
      imgImageSource = imageSource;
      this._logger.debug("getImageSource: node name: canonical URL: " + imageSource);
    }

    // check special cases
    if (null != imageSource && pageInfo.getSpecialSource) {
      imageSource = pageInfo.getSpecialSource(aNode, imageSource);
      this._logger.debug("getImageSource: node name: getSpecialSource returned " + imageSource);
    }
    
    // check other image nodes.
    if (forceUseImgNode) {
      if (aNode.localName.toLowerCase() == "img") {
        imageSource = imgImageSource;
        result.noTooSmallWarning = true;
      } else {
        imageSource = null;
      }
    } else if (null == imageSource && pageInfo.getImageNode) {
      let nodeClass = aNode.getAttribute("class");
      let imageNode = null;
      imageNode = pageInfo.getImageNode(aNode, nodeName, nodeClass);
      if (imageNode == aNode && "img" == nodeName) {
        // the image source is the thumb itself; don't warn if the image
        // is too small since we'd see too many warnings.
        result.noTooSmallWarning = true;
      }
      
      if (imageNode) {
        if (imageNode.hasAttribute("src")) {
          imageSource = imageNode.getAttribute("src");
        } else if (imageNode.hasAttribute("href")) {
          // for an <a href=> node, use javascript string conversion rather
          // than retrieving the html attribute so it'll apply the base
          // document's URL for missing components of the URL (eg domain).
          imageSource = String(imageNode);
          if (/^https?:\/\/t\.co\//.test(imageSource)) {
			      // Special case for twitter http://t.co links; the actual
			      // URL is in the link's tooltip.
            imageSource = imageNode.title;
          }
        } else {
          let backImage = imageNode.style.backgroundImage;

          if (backImage && "" != backImage) {
            imageSource = backImage.replace(/url\(\"/, "").replace(/\"\)/, "");
          }
        }
      }
    }
    if (imageSource != null) {
      imageSource = this._applyBaseURI(aDocument, imageSource);
    }
    this._logger.debug("getImageSource: using image source       " + imageSource +
                       "; noTooSmallWarning=" + result.noTooSmallWarning);
    
    result.imageURL = imageSource;
    
    return result;
  },

  /**
   * Filters an image source url.
   * @param aImageSrc the image source url.
   * @param aPage the page constant.
   * @return true if valid, false otherwise.
   */
  filterImage : function(aImageSrc, aPage) {
    this._logger.debug("filterImage");

    let validImage = false;
    let exp = this.pageList[aPage].imageRegExp;
    let regExp = new RegExp(exp);

    if (regExp.test(aImageSrc)) {
      validImage = true;
    } else {
      this._logger.debug("ThumbnailPreview: filterImage rejected " + aImageSrc + " using " + exp);
    }

    return validImage;
  },

  /**
   * Gets the zoomed image source.
   * @param aImageSrc the image source url.
   * @param aPage the filtered page.
   * @return the zoomed image source.
   */
  getZoomImage : function(aImageSrc, aPage) {
    this._logger.debug("getZoomImage");

    let pageInfo = this.pageList[aPage];
    let zoomImage = pageInfo.getZoomImage(aImageSrc);
    this._logger.debug("ThumbnailPreview: getZoomImage returned " + zoomImage);

    return zoomImage;
  }
};

/**
 * Constructor.
 */
(function() { this._init(); }).apply(ThumbnailZoomPlus.FilterService);
