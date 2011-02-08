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
 * The Filter Service.
 */
ImageZoom.FilterService = {
  /* Pages info list. */
  pageList : [
    ImageZoom.Pages.Facebook,
    ImageZoom.Pages.Twitter,
    ImageZoom.Pages.Twitpic,
    ImageZoom.Pages.LinkedIn,
    ImageZoom.Pages.MySpace,
    ImageZoom.Pages.Hi5,
    ImageZoom.Pages.Amazon,
    ImageZoom.Pages.Picasa,
    ImageZoom.Pages.Flickr,
    ImageZoom.Pages.DeviantART,
    ImageZoom.Pages.PhotoBucket,
    ImageZoom.Pages.Wikipedia,
    ImageZoom.Pages.Tagged,
    ImageZoom.Pages.LastFM,
    ImageZoom.Pages.Google,
    ImageZoom.Pages.YouTube,
    ImageZoom.Pages.DailyMile
  ],

  /* Logger for this object. */
  _logger : null,

  /**
   * Initializes the resource.
   */
  _init : function() {
    this._logger = ImageZoom.getLogger("ImageZoom.FilterService");
    this._logger.trace("_init");
  },

  /**
   * Detects and gets the page constant.
   * @param aDocument the document object.
   * @return the page constant.
   */
  getPageConstantByDoc : function(aDocument) {
    this._logger.debug("getPageConstantByDoc");

    let pageConstant = -1;

    if (aDocument.location &&
        ("http:" == aDocument.location.protocol ||
         "https:" == aDocument.location.protocol)) {
      let host = aDocument.location.host;
      let pageCount = this.pageList.length;

      for (let i = 0; i < pageCount; i++) {
        let hostRegExp = new RegExp(this.pageList[i].host);
        if (hostRegExp.test(host)) {
          pageConstant = i;
          break;
        }
      }
    }

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
    this._logger.debug("isPageEnabled");

    let pageEnable = false;
    let pageName = this.getPageName(aPage);

    if (null != pageName) {
      let pagePrefKey = ImageZoom.PrefBranch + pageName + ".enable";

      pageEnable = ImageZoom.Application.prefs.get(pagePrefKey).value;
    }

    return pageEnable;
  },

  /**
   * Toggles the value of the page if enabled.
   * @param aPage the page constant.
   */
  togglePageEnable : function(aPage) {
    this._logger.debug("togglePageEnable");

    let pageName = this.getPageName(aPage);

    if (null != pageName) {
      let pagePrefKey = ImageZoom.PrefBranch + pageName + ".enable";
      let pageEnable = ImageZoom.Application.prefs.get(pagePrefKey).value;

      ImageZoom.Application.prefs.setValue(pagePrefKey, !pageEnable);
    }
  },

  /**
   * Gets the image source, handle special cases.
   * @param aNode the html node.
   * @param aPage the page constant.
   * @return the image source, null if not apply.
   */
  getImageSource : function(aNode, aPage) {
    this._logger.debug("getImageSource");

    let pageInfo = this.pageList[aPage];
    let nodeName = aNode.localName.toLowerCase();
    let imageSource = ("img" == nodeName ? aNode.getAttribute("src") : null);

    // check special cases
    if (null != imageSource && pageInfo.getSpecialSource) {
      imageSource = pageInfo.getSpecialSource(aNode, imageSource);
    }
    // check other image nodes.
    if (null == imageSource && pageInfo.getImageNode) {
      let nodeClass = aNode.getAttribute("class");
      let imageNode = pageInfo.getImageNode(aNode, nodeName, nodeClass);

      if (imageNode) {
        if (imageNode.hasAttribute("src")) {
          imageSource = imageNode.getAttribute("src");
        } else {
          let backImage = imageNode.style.backgroundImage;

          if (backImage && "" != backImage) {
            imageSource = backImage.replace(/url\(\"/, "").replace(/\"\)/, "");
          }
        }
      }
    }

    return imageSource;
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
    let regExp = new RegExp(this.pageList[aPage].imageRegExp);

    if (regExp.test(aImageSrc)) {
      validImage = true;
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

    return zoomImage;
  }
};

/**
 * Constructor.
 */
(function() { this._init(); }).apply(ImageZoom.FilterService);
