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
  DEVIANTART  : 9,
  PHOTOBUCKET : 10,
  TWITPIC     : 11,

  /* Pages info. */
  PAGE_INFO : [
    { key: "twitter", name: "Twitter",
      host: "twitter.com",
      imageRegExp: /twimg\.com\/profile_images\// },
    { key: "facebook", name: "Facebook",
      host: "www.facebook.com",
      imageRegExp: /(profile|photos-[a-z])\.ak\.fbcdn\.net\// },
    { key: "linkedin", name: "LinkedIn",
      host: "www.linkedin.com",
      imageRegExp: /media[0-9][0-9]\.linkedin.com\/mpr\// },
    { key: "amazon", name: "Amazon",
      host: "www.amazon.com",
      imageRegExp: /\/ecx\.images\-amazon\.com\/images/ },
    { key: "hi5", name: "Hi5",
      host: "www.hi5.com",
      imageRegExp: /(photos[0-9]+|pics)\.hi5\.com/ },
    { key: "picasa", name: "Picasa",
      host: "picasaweb.google.com",
      imageRegExp: /lh[0-9]+.ggpht.com/ },
    { key: "myspace", name: "MySpace",
      host: "myspace.com",
      imageRegExp: /c[0-9]+\.ac-images\.myspacecdn\.com/ },
    { key: "flickr", name: "Flickr",
      host: "www.flickr.com",
      imageRegExp: /farm[0-9]+\.static\.flickr\.com/ },
    { key: "wikipedia", name: "Wikipedia",
      host: "wikipedia.org",
      imageRegExp: /upload\.wikimedia\.org\/wikipedia\/commons/ },
    { key: "deviantart", name: "deviantART",
      host: "deviantart.com",
      imageRegExp: /th[0-9]+\.deviantart.net/ },
    { key: "photobucket", name: "PhotoBucket",
      host: "photobucket.com",
      imageRegExp: /[0-9]+\.photobucket.com\/albums/ },
    { key: "twitpic", name: "Twitpic",
      host: "twitpic.com",
      imageRegExp:
        /(twimg\.com\/profile_images\/)|(web[0-9][0-9]\.twitpic\.com\/img)/ }
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
      let pageCount = this.PAGE_INFO.length;

      for (let i = 0; i < pageCount; i++) {
        if (-1 != host.indexOf(this.PAGE_INFO[i].host)) {
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

    let pageCount = this.PAGE_INFO.length;
    let pageConstant = -1;

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
   * Gets the image source, handle special cases.
   * @param aNode the html node.
   * @param aPage the page constant.
   * @return the image source, null if not apply.
   */
  getImageSource : function(aNode, aPage) {
    this._logger.debug("getImageSource");

    let imageSrc = null;
    let nodeName = aNode.localName.toLowerCase();

    if ("img" == nodeName) {
      imageSrc = aNode.getAttribute("src");
    } else {
      let nodeImage = aNode.style.backgroundImage;

      if (null != nodeImage) {
        let isValidImage = false;

        switch (aPage) {
          case this.FACEBOOK:
            if ("i" == nodeName) {
              isValidImage = true;
            }
            break;
          case this.PHOTOBUCKET:
            if ("div" == nodeName && "thumb" == aNode.getAttribute("class")) {
              isValidImage = true;
            }
            break;
        }

        if (isValidImage) {
          imageSrc = nodeImage.replace(/url\(\"/, "").replace(/\"\)/, "");
        }
      }
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
    let regExp3 = null;

    switch (aPage) {
      case this.TWITTER:
        regExp1 = new RegExp(/_(bigger|mini|normal)\./);
        if (regExp1.test(aImageSrc)) {
          bigImageSrc = aImageSrc.replace(regExp1, ".");
        }
        break;
      case this.FACEBOOK:
        regExp1 = new RegExp(/_[qsta]\./);
        regExp2 = new RegExp(/([0-9]\/)[qsta]([0-9])/);
        if (regExp1.test(aImageSrc)) {
          bigImageSrc = aImageSrc.replace(regExp1, "_n.");
        } else if (regExp2.test(aImageSrc)) {
          bigImageSrc = aImageSrc.replace(regExp2, "$1n$2");
        }
        break;
      case this.LINKEDIN:
        regExp1 = new RegExp(/\/shrink_[0-9][0-9]_[0-9][0-9]\//);
        bigImageSrc = aImageSrc.replace(regExp1, "/");
        break;
      case this.AMAZON:
        regExp1 = new RegExp(/\._[a-z].+_\./i);
        bigImageSrc = aImageSrc.replace(regExp1, ".");
        break;
      case this.HI5:
        regExp1 = new RegExp(/\-01\./);
        regExp2 = new RegExp(/\.small\./);
        if (regExp1.test(aImageSrc)) {
          bigImageSrc = aImageSrc.replace(regExp1, "-02.");
        } else if (regExp2.test(aImageSrc)) {
          bigImageSrc = aImageSrc.replace(regExp2, ".");
        }
        break;
      case this.PICASA:
        regExp1 = new RegExp(/\/s([0-9]{2}|[123][0-9]{2})(-c)?\//);
        if (regExp1.test(aImageSrc)) {
          bigImageSrc = aImageSrc.replace(regExp1, "/s700/");
        }
        break;
      case this.MYSPACE:
        regExp1 = new RegExp(/\/[sm](_.+\.)/);
        if (regExp1.test(aImageSrc)) {
          bigImageSrc = aImageSrc.replace(regExp1, "/l$1");
        }
        break;
      case this.FLICKR:
        regExp1 = new RegExp(/_[smt]\./);
        if (regExp1.test(aImageSrc)) {
          bigImageSrc = aImageSrc.replace(regExp1, ".");
        }
        break;
      case this.WIKIPEDIA:
        regExp1 = new RegExp(/\/thumb\//);
        regExp2 = new RegExp(/(\.[a-z]+)\/\d+px-.+\.[a-z]+/i);
        regExp3 = new RegExp(/\.svg/);
        if (regExp1.test(aImageSrc) && regExp2.test(aImageSrc) &&
            !regExp3.test(aImageSrc)) {
          bigImageSrc = aImageSrc.replace(regExp1, "/").replace(regExp2,"$1");
        }
        break;
      case this.DEVIANTART:
        regExp1 = new RegExp(/(fs\d+\/)\w+\/([fiop])/);
        if (regExp1.test(aImageSrc)) {
          bigImageSrc = aImageSrc.replace(regExp1, "$1$2");
        }
        break;
      case this.PHOTOBUCKET:
        regExp1 = new RegExp(/\/th_/);
        if (regExp1.test(aImageSrc)) {
          bigImageSrc = aImageSrc.replace(regExp1, "/");
        }
        break;
      case this.TWITPIC:
        regExp1 = new RegExp(/_(bigger|mini|normal)\./);
        regExp2 = new RegExp(/-(mini|thumb)\./);
        if (regExp1.test(aImageSrc)) {
          bigImageSrc = aImageSrc.replace(regExp1, ".");
        } else if (regExp2.test(aImageSrc)) {
          bigImageSrc = aImageSrc.replace(regExp2, "-full.");
        }
        break;
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
