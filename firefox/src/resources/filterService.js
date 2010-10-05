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
  /* Pages contants. */
  TWITTER     : 0,
  FACEBOOK    : 1,
  LINKEDIN    : 2,
  AMAZON      : 3,
  HI5         : 4,
  PICASA      : 5,
  MYSPACE     : 6,
  FLICKR      : 7,
  WIKIPEDIA   : 8,
  DEVIANART   : 9,
  PHOTOBUCKET : 10,

  /* Pages info. */
  PAGE_INFO : [
    { key: "twitter",
      imageRegExp: /twimg\.com\/profile_images\// },
    { key: "facebook",
      imageRegExp: /(profile|photos-[a-z])\.ak\.fbcdn\.net\// },
    { key: "linkedin",
      imageRegExp: /media[0-9][0-9]\.linkedin.com\/mpr\// },
    { key: "amazon",
      imageRegExp: /\/ecx\.images\-amazon\.com\/images/ },
    { key: "hi5",
      imageRegExp: /(photos[0-9]+|pics)\.hi5\.com/ },
    { key: "picasa",
      imageRegExp: /lh[0-9]+.ggpht.com/ },
    { key: "myspace",
      imageRegExp: /c[0-9]+\.ac-images\.myspacecdn\.com/ },
    { key: "flickr",
      imageRegExp: /farm[0-9]+\.static\.flickr\.com/ },
    { key: "wikipedia",
      imageRegExp: /a/ },
    { key: "devianart",
      imageRegExp: /a/ },
    { key: "photobucket",
      imageRegExp: /a/ }
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

      if (-1 != host.indexOf("myspace.com")) {
        pageConstant = this.MYSPACE;
      } else {
        switch (host) {
          case "twitter.com":
            pageConstant = this.TWITTER;
            break;
          case "www.facebook.com":
            pageConstant = this.FACEBOOK;
            break;
          case "www.linkedin.com":
            pageConstant = this.LINKEDIN;
            break;
          case "www.amazon.com":
            pageConstant = this.AMAZON;
            break;
          case "www.hi5.com":
            pageConstant = this.HI5;
            break;
          case "picasaweb.google.com":
            pageConstant = this.PICASA;
            break;
          case "www.flickr.com":
            pageConstant = this.FLICKR;
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

    let pageCount = this.PAGE_INFO.length;
    let pageConstant = null;

    for (let i = 0; i < pageCount; i++) {
      if (this.PAGE_INFO[i].key == aPageName) {
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

    return this.PAGE_INFO[aPageConstant].key;
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
   * Gets the image source.
   * @param aImageNode the image node.
   * @param aPage the page constant.
   * @return the image source, null if not apply.
   */
  getImageSource : function(aImageNode, aPage) {
    this._logger.debug("getImageSource");

    let imageSrc = null;

    if ("img" == aImageNode.localName.toLowerCase()) {
      imageSrc = aImageNode.getAttribute("src");
    } else if (this.FACEBOOK == aPage &&
               "i" == aImageNode.localName.toLowerCase() &&
               null != aImageNode.style.backgroundImage) {
      imageSrc = aImageNode.style.backgroundImage;
      imageSrc = imageSrc.replace(/url\(\"/, "").replace(/\"\)/,"");
    }

    return imageSrc;
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
    let regExp = new RegExp(this.PAGE_INFO[aPage].imageRegExp);

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

    let bigImageSrc = null;
    let regExp1 = null;
    let regExp2 = null;

    switch (aPage) {
      case this.TWITTER:
        regExp1 = new RegExp(/(_bigger\.)|(_mini\.)|(_normal\.)/);
        if (regExp1.test(aImageSrc)) {
          bigImageSrc =
            aImageSrc.replace(/(_bigger\.)|(_mini\.)|(_normal\.)/, ".");
        }
        break;
      case this.FACEBOOK:
        regExp1 = new RegExp(/_[qsta]\./);
        regExp2 = new RegExp(/[0-9]\/[qsta][0-9]/);
        if (regExp1.test(aImageSrc)) {
          bigImageSrc = aImageSrc.replace(/_[qsta]\./, "_n.");
        } else if (regExp2.test(aImageSrc)) {
          bigImageSrc = aImageSrc.replace(/\/[qsta]/, "/n");
        }
        break;
      case this.LINKEDIN:
        bigImageSrc =
          aImageSrc.replace(/\/shrink_[0-9][0-9]_[0-9][0-9]\//, "/");
        break;
      case this.AMAZON:
        bigImageSrc = aImageSrc.replace(/\._[A-Z].+_\./, ".");
        break;
      case this.HI5:
        regExp1 = new RegExp(/\-01\./);
        regExp2 = new RegExp(/\.small\./);
        if (regExp1.test(aImageSrc)) {
          bigImageSrc = aImageSrc.replace(/\-01\./, "-02.");
        } else if (regExp2.test(aImageSrc)) {
          bigImageSrc = aImageSrc.replace(/\.small\./, ".");
        }
        break;
      case this.PICASA:
        regExp1 = new RegExp(/\/s([0-9]{2}|[123][0-9]{2})(-c)?\//);
        if (regExp1.test(aImageSrc)) {
          bigImageSrc =
            aImageSrc.replace(/\/s([0-9]{2}|[123][0-9]{2})(-c)?\//, "/s700/");
        }
        break;
      case this.MYSPACE:
        regExp1 = new RegExp(/\/[sm]_.+\./);
        if (regExp1.test(aImageSrc)) {
          bigImageSrc = aImageSrc.replace(/\/[sm]_/, "/l_");
        }
        break;
      case this.FLICKR:
        regExp1 = new RegExp(/_[smt]\./);
        if (regExp1.test(aImageSrc)) {
          bigImageSrc = aImageSrc.replace(/_[smt]\./, ".");
        }
    }

    return bigImageSrc;
  }
};

/**
 * Constructor.
 */
(function() {
  this._init();
}).apply(ImageZoom.FilterService);
