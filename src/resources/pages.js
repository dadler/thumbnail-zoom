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
 * Pages namespace
 */
if ("undefined" == typeof(ImageZoom.Pages)) {
  ImageZoom.Pages = {};
};

/**
 * Facebook
 */
ImageZoom.Pages.Facebook = {
  key: "facebook",
  name: "Facebook",
  host: /\.facebook\.com/,
  imageRegExp: /profile|photos-[a-z]\.((ak\.fbcdn)|(akamaihd))\.net\//,
  getImageNode : function(aNode, aNodeName, aNodeClass) {
    let image = ("i" == aNodeName ? aNode : ("a" == aNodeName &&
      "album_link" == aNodeClass ? aNode.parentNode : null));
    return image;
  },
  getSpecialSource : function(aNode, aNodeSource) {
    let imageSource = aNodeSource;
    let rex = new RegExp(/static\.ak\.fbcdn\.net/);
    if (rex.test(aNodeSource)) {
      if (-1 == aNode.style.backgroundImage.indexOf("url")) {
        imageSource = aNode.nextSibling.getAttribute("src");
      } else {
        imageSource = aNode.style.backgroundImage.
          replace(/url\(\"/, "").replace(/\"\)/, "");
      }
    }
    return imageSource;
  },
  getZoomImage : function(aImageSrc) {
    let rex1 = new RegExp(/_[qstan]\./);
    let rex2 = new RegExp(/([0-9]\/)[qsta]([0-9])/);
    let image = (rex1.test(aImageSrc) ? aImageSrc.replace(rex1, "_n.") :
      (rex2.test(aImageSrc) ? aImageSrc.replace(rex2, "$1n$2") : null));
    return image;
  }
};

/**
 * Twitter
 */
ImageZoom.Pages.Twitter = {
  key: "twitter",
  name: "Twitter",
  host: /twitter\.com/,
  imageRegExp: /twimg\.com\/profile_images\//,
  getZoomImage : function(aImageSrc) {
    let rex = new RegExp(/_(bigger|mini|normal|reasonably_small)\./);
    let image = (rex.test(aImageSrc) ? aImageSrc.replace(rex, ".") : null);
    return image;
  }
};

/**
 * Twitpic
 */
ImageZoom.Pages.Twitpic = {
  key: "twitpic",
  name: "Twitpic",
  host: /twitpic\.com/,
  imageRegExp:
    /(twimg\.com\/profile_images\/)|(web[0-9][0-9]\.twitpic\.com\/img)/,
  getZoomImage : function(aImageSrc) {
    let rex1 = new RegExp(/_(bigger|mini|normal|reasonably_small)\./);
    let rex2 = new RegExp(/-(mini|thumb)\./);
    let image = (rex1.test(aImageSrc) ? aImageSrc.replace(rex1, ".") :
      (rex2.test(aImageSrc) ? aImageSrc.replace(rex2, "-full.") : null));
    return image;
  }
};

/**
 * LinkedIn
 */
ImageZoom.Pages.LinkedIn = {
  key: "linkedin",
  name: "LinkedIn",
  host: /\.linkedin\.com/,
  imageRegExp: /media[0-9][0-9]\.linkedin.com\/mpr\//,
  getZoomImage : function(aImageSrc) {
    return aImageSrc.replace(/\/shrink_[0-9][0-9]_[0-9][0-9]\//, "/");
  }
};

/**
 * Amazon
 */
ImageZoom.Pages.Amazon = {
  key: "amazon",
  name: "Amazon",
  host: /www\.amazon\.[a-z]+/,
  imageRegExp: /\/(g-)?ecx\.images\-amazon\.com\/images/,
  getZoomImage : function(aImageSrc) {
    return aImageSrc.replace(/\._[a-z].+_\./i, ".");
  }
};

/**
 * Hi5
 */
ImageZoom.Pages.Hi5 = {
  key: "hi5",
  name: "Hi5",
  host: /\.hi5\.com/,
  imageRegExp: /(photos[0-9]+|pics)\.hi5\.com/,
  getZoomImage : function(aImageSrc) {
    let rex1 = new RegExp(/\-01\./);
    let rex2 = new RegExp(/\.small\./);
    let image = (rex1.test(aImageSrc) ? aImageSrc.replace(rex1, "-02.") :
      (rex2.test(aImageSrc) ? aImageSrc.replace(rex2, ".") : null));
    return image;
  }
};

/**
 * Picasa
 */
ImageZoom.Pages.Picasa = {
  key: "picasa",
  name: "Picasa",
  host: /picasaweb\.google\.com/,
  imageRegExp: /lh[0-9]+\.(ggpht|googleusercontent)\.com/,
  getZoomImage : function(aImageSrc) {
    let rex = new RegExp(/\/s([0-9]{2}|[123][0-9]{2})(-c)?\//);
    let image = (rex.test(aImageSrc) ? aImageSrc.replace(rex, "/s700/") : null);
    return image;
  }
};

/**
 * MySpace
 */
ImageZoom.Pages.MySpace = {
  key: "myspace",
  name: "MySpace",
  host: /myspace\.com/,
  imageRegExp: /images\.myspacecdn\.com/,
  getSpecialSource : function(aNode, aNodeSource) {
    let imageSource = (aNode.hasAttribute("data-src") ?
      aNode.getAttribute("data-src") : aNodeSource);
    return imageSource;
  },
  getZoomImage : function(aImageSrc) {
    let rex1 = new RegExp(/(\/|\_)[sml]\./i);
    let rex2 = new RegExp(/\/(sml|med|lrg)_/i);
    let image = (rex1.test(aImageSrc) ? aImageSrc.replace(rex1, "$1l.") :
      (rex2.test(aImageSrc) ? aImageSrc.replace(rex2, "/lrg_") : null));
    return image;
  }
};

/**
 * Flickr
 */
ImageZoom.Pages.Flickr = {
  key: "flickr",
  name: "Flickr",
  host: /www\.flickr\.com/,
  imageRegExp: /farm[0-9]+\.static\.flickr\.com/,
  getSpecialSource : function(aNode, aNodeSource) {
    let imageSource = (-1 != aNodeSource.indexOf("spaceball.gif") ?
      aNode.parentNode.previousSibling.firstChild.firstChild.getAttribute("src")
      : aNodeSource);
    return imageSource;
  },
  getZoomImage : function(aImageSrc) {
    let rex = new RegExp(/_[smt]\./);
    let image = (rex.test(aImageSrc) ? aImageSrc.replace(rex, ".") : null);
    return image;
  }
};

/**
 * Wikipedia
 */
ImageZoom.Pages.Wikipedia = {
  key: "wikipedia",
  name: "Wikipedia",
  host: /wikipedia\.org/,
  imageRegExp: /upload\.wikimedia\.org\/wikipedia\/commons/,
  getZoomImage : function(aImageSrc) {
    let rex1 = new RegExp(/\/thumb\//);
    let rex2 = new RegExp(/(\.[a-z]+)\/\d+px-.+\.[a-z]+/i);
    let rex3 = new RegExp(/\.svg/);
    let image =
      (rex1.test(aImageSrc) && rex2.test(aImageSrc) && !rex3.test(aImageSrc) ?
       aImageSrc.replace(rex1, "/").replace(rex2,"$1") : null);
    return image;
  }
};

/**
 * DeviantART
 */
ImageZoom.Pages.DeviantART = {
  key: "deviantart",
  name: "deviantART",
  host: /deviantart\.com/,
  imageRegExp: /th[0-9]+\.deviantart.net/,
  getZoomImage : function(aImageSrc) {
    let rex = new RegExp(/(fs\d+\/)\w+\/([fiop])/);
    let image = (rex.test(aImageSrc) ? aImageSrc.replace(rex, "$1$2") : null);
    return image;
  }
};

/**
 * PhotoBucket
 */
ImageZoom.Pages.PhotoBucket = {
  key: "photobucket",
  name: "PhotoBucket",
  host: /photobucket\.com/,
  imageRegExp: /[0-9]+\.photobucket.com\/(albums|groups)/,
  getImageNode : function(aNode, aNodeName, aNodeClass) {
    return ("div" == aNodeName && "thumb" == aNodeClass ? aNode : null);
  },
  getZoomImage : function(aImageSrc) {
    let rex = new RegExp(/\/th_/);
    let image = (rex.test(aImageSrc) ? aImageSrc.replace(rex, "/") : null);
    return image;
  }
};

/**
 * Tagged
 */
ImageZoom.Pages.Tagged = {
  key: "tagged",
  name: "Tagged",
  host: /\.tagged\.com/,
  imageRegExp: /[a-z]+[0-9]+\.tagstat.com\/image/,
  getZoomImage : function(aImageSrc) {
    let rex = new RegExp(/\/[123456789]0([\w-]+\.[a-z]+)/);
    let image = (rex.test(aImageSrc) ? aImageSrc.replace(rex, "/00$1") : null);
    return image;
  }
};

/**
 * Last.fm
 */
ImageZoom.Pages.LastFM = {
  key: "lastfm",
  name: "Last.fm",
  host: /www\.last\.fm/,
  imageRegExp: /userserve-ak\.last\.fm\/serve/,
  getZoomImage : function(aImageSrc) {
    let rex = new RegExp(/\/serve\/\w+\//);
    let image =
      (rex.test(aImageSrc) ? aImageSrc.replace(rex, "/serve/_/") : null);
    return image;
  },
  getImageNode : function(aNode, aNodeName, aNodeClass) {
    let image = null;
    if ("span" == aNodeName  && aNode.previousSibling) {
      if ("overlay" == aNodeClass) {
        image = aNode.previousSibling.firstChild;
      } else if ("jewelcase" == aNodeClass) {
        image = aNode.previousSibling;
      }
    }
    return image;
  }
};

/**
 * Google
 */
ImageZoom.Pages.Google = {
  key: "google",
  name: "Google Images",
  host: /\.google\.[a-z\.]+/,
  imageRegExp: /.+/,
  getSpecialSource : function(aNode, aNodeSource) {
    let imageSource = null;
    let imageHref = aNode.parentNode.getAttribute("href");
    if (null != imageHref) {
      let imageIndex = imageHref.indexOf("imgurl=");
      if (-1 < imageIndex) {
        imageSource = decodeURIComponent(imageHref.substring(
          imageIndex + 7, imageHref.indexOf("&", imageIndex)));
      }
    }
    return imageSource;
  },
  getZoomImage : function(aImageSrc) {
    return aImageSrc;
  }
};

/**
 * YouTube
 */
ImageZoom.Pages.YouTube = {
  key: "youtube",
  name: "YouTube",
  host: /www\.youtube\.com/,
  imageRegExp: /i[0-9]+\.ytimg\.com\/vi\//,
  getZoomImage : function(aImageSrc) {
    let rex = new RegExp(/\/default\./);
    let image =
      (rex.test(aImageSrc) ? aImageSrc.replace(rex, "/hqdefault.") : null);
    return image;
  },
  getSpecialSource : function(aNode, aNodeSource) {
    if (-1 == aNodeSource.indexOf("http:") &&
        -1 == aNodeSource.indexOf("https:")) {
      aNodeSource = "http:" + aNodeSource;
    }
    return aNodeSource;
  }
};

/**
 * Daily Mile
 */
ImageZoom.Pages.DailyMile = {
  key: "dailymile",
  name: "Daily Mile",
  host: /dailymile\.com/,
  imageRegExp: /(dmimg|dailymile)\.com\/(images|pictures|photos)\//,
  getZoomImage : function(aImageSrc) {
    let rex = new RegExp(/_(mini|profile|preview|avatar)\./);
    let image = (rex.test(aImageSrc) ? aImageSrc.replace(rex, ".") : aImageSrc);
    return image;
  }
};

/**
 * IMDb
 */
ImageZoom.Pages.IMDb = {
  key: "imdb",
  name: "IMDb",
  host: /www\.imdb\.[a-z]+/,
  imageRegExp: /ia\.media\-imdb\.com\/images\//,
  getZoomImage : function(aImageSrc) {
    let rex = new RegExp(/\._.+_(\.[a-z]+)/i);
    let image = (rex.test(aImageSrc) ? aImageSrc.replace(rex, "$1") : null);
    return image;
  }
};

/**
 * Imgur
 */
ImageZoom.Pages.Imgur = {
  key: "imgur",
  name: "Imgur",
  host: /imgur\.com/,
  imageRegExp: /(i\.)?imgur\.com\//,
  getZoomImage : function(aImageSrc) {
    let rex = new RegExp(/[bsm](\.[a-z]+)/i);
    let image = (rex.test(aImageSrc) ? aImageSrc.replace(rex, "$1") : null);
    return image;
  }
};

/**
 * Photosight
 *
 * ex:
 * http://s.photosight.ru/img/4/aef/4167500_icon.jpg
 * http://s.photosight.ru/img/4/aef/4167500_large.jpg
 * ex2:
 * http://img-1.photosight.ru/e68/4167692_top_of_day.jpg
 * http://img-1.photosight.ru/e68/4167692_large.jpg
 * ex3:
 * http://s.photosight.ru/img/5/7bd/4167881_crop_1.jpeg
 * http://s.photosight.ru/img/5/7bd/4167881_large.jpeg
 */
ImageZoom.Pages.Photosight = {
  key: "photosight",
  name: "Photosight",
  host: /photosight\.ru/,
  imageRegExp: /\.photosight\.ru/,
  getZoomImage : function(aImageSrc) {
    let rex1 = new RegExp(/_(icon)\./);
    let rex2 = new RegExp(/_(crop)_[0-9]+\./);
    let rex3 = new RegExp(/_top_of_day\./);
    let image = (rex1.test(aImageSrc) ? aImageSrc.replace(rex1, "_large.") :
      (rex2.test(aImageSrc) ? aImageSrc.replace(rex2, "_large.") :
      (rex3.test(aImageSrc) ? aImageSrc.replace(rex3, "_large.") : null)));
    return image;
  }
};
