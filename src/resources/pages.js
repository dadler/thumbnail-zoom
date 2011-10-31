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

Cu.import("resource://thumbnailzoomplus/common.js");

/**
 * Pages namespace
 */
if ("undefined" == typeof(ThumbnailZoomPlus.Pages)) {

  ThumbnailZoomPlus.Pages = {
    /* Logger for this object. */
    _logger : null,
    
    /**
     * Initializes the resource.
     */
    _init : function() {
      this._logger = ThumbnailZoomPlus.getLogger("ThumbnailZoomPlus.Pages");
      this._logger.trace("_init");
    }
  };
  ThumbnailZoomPlus.Pages._init();
};

/**
 * Facebook
 */
ThumbnailZoomPlus.Pages.Facebook = {
  key: "facebook",
  name: "Facebook",
  host: /\.facebook\.com/,
  /*
     Thumb URLs seem different when logged into Facebook vs when logged out
     and refreshed.  When logged in I see akamaihd; when logged out I see fbcdn.
     test e.g. at https://www.facebook.com/Levis?sk=wall
   */
  imageRegExp: /profile|\.(fbcdn|akamaihd)\.net\//,
  getImageNode : function(aNode, aNodeName, aNodeClass) {
    let image = ("i" == aNodeName ? aNode : ("a" == aNodeName &&
      "album_link" == aNodeClass ? aNode.parentNode : null));
    return image;
  },
  getSpecialSource : function(aNode, aNodeSource) {
    let imageSource = aNodeSource;
    let rex = new RegExp(/static\.ak\.fbcdn\.net/);
    if (rex.test(aNodeSource)) {
      // Facebook photos sometimes use an <i> tag with the image
      // displayed via a style with background-image.
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
    let rex1 = new RegExp(/_[qsta]\./);
    let rex2 = new RegExp(/([0-9]\/)[qsta]([0-9])/);
    // Apply replacement for rex1 or rex2; reject if neither matches.
    let image = (rex1.test(aImageSrc) ? aImageSrc.replace(rex1, "_n.") :
      (rex2.test(aImageSrc) ? aImageSrc.replace(rex2, "$1n$2") : null));
    if (image == null) {
      return null;
    }
    let rex3 = new RegExp(/\/s[0-9]+x[0-9]+\//);
    image = image.replace(rex3, "/");
    return image;
  }
};

/**
 * Twitter
 */
ThumbnailZoomPlus.Pages.Twitter = {
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
ThumbnailZoomPlus.Pages.Twitpic = {
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
ThumbnailZoomPlus.Pages.LinkedIn = {
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
ThumbnailZoomPlus.Pages.Amazon = {
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
ThumbnailZoomPlus.Pages.Hi5 = {
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
ThumbnailZoomPlus.Pages.Picasa = {
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
ThumbnailZoomPlus.Pages.MySpace = {
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
ThumbnailZoomPlus.Pages.Flickr = {
  key: "flickr",
  name: "Flickr",
  host: /\.flickr\.com/,
  imageRegExp: /farm[0-9]+\.static\.flickr\.com|l.yimg.com\/g\/images\/spaceout.gif/,
  getSpecialSource : function(aNode, aNodeSource) {
    let imageSource = (-1 != aNodeSource.indexOf("spaceball.gif") ?
      aNode.parentNode.previousSibling.firstChild.firstChild.getAttribute("src")
      : aNodeSource);
    if (-1 != aNodeSource.indexOf("spaceout.gif")) {
      imageSource = aNode.parentNode.parentNode.firstChild.firstChild.getAttribute("src");
    }
    return imageSource;
  },
  getZoomImage : function(aImageSrc) {
    let rex = new RegExp(/_[smt]\./);
    // For bigger images, change _z to _b (but may download slower).
    let image = (rex.test(aImageSrc) ? aImageSrc.replace(rex, "_z.") : null);

    return image;
  }
};

/**
 * Wikipedia
 */
ThumbnailZoomPlus.Pages.Wikipedia = {
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
ThumbnailZoomPlus.Pages.DeviantART = {
  // https://s.deviantart.com/th/fs70/150/i/2011/244/0/2/they__ll_name_a_city_after_us_by_majdear-d48jvmu.jpg becomes
  // https://s.deviantart.com/th/fs70/i/2011/244/0/2/they__ll_name_a_city_after_us_by_majdear-d48jvmu.jpg
  key: "deviantart",
  name: "deviantART",
  host: /deviantart\.com/,
  imageRegExp: /(th[0-9]+|s).deviantart.(net|com)/,
  getZoomImage : function(aImageSrc) {
    let rex = new RegExp(/(fs\d+\/)\w+\/([fiop])/);
    let image = (rex.test(aImageSrc) ? aImageSrc.replace(rex, "$1$2") : null);
    return image;
  }
};

/**
 * PhotoBucket
 */
ThumbnailZoomPlus.Pages.PhotoBucket = {
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
ThumbnailZoomPlus.Pages.Tagged = {
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
ThumbnailZoomPlus.Pages.LastFM = {
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
 * Google+
 */
ThumbnailZoomPlus.Pages.Google = {
  key: "google",
  name: "Google+",
  host: /plus\.google\.com/,
  imageRegExp: /\.(ggpht|googleusercontent)\.com/,
  _logger: ThumbnailZoomPlus.Pages._logger,
  getZoomImage : function(aImageSrc) {

    // example profile pic link: https://lh3.googleusercontent.com/-TouICNeczXY/AAAAAAAAAAI/AAAAAAAAAf8/eS42KCD74YM/photo.jpg?sz=80
    // example image link: https://lh3.googleusercontent.com/-TouICNeczXY/AAAAAAAAAAI/AAAAAAAAAf8/eS42KCD74YM/photo.jpg
    // Note: the sz=48 or 32 or 24 case is the tiny thumb for which Google already has a popup which
    // shows a medium thumb and Add To Circles; we don't want our popup from that tiny one.
    let rex_prohibit = new RegExp(/\/photo\.jpg\?sz=(24|32|48)$/);
    if (rex_prohibit.test(aImageSrc)) {
      this._logger.debug("matched google+ tiny profile pic, from which we won't popup");
      return null;
    }

    let rex3 = new RegExp(/\/photo\.jpg\?sz=([0-9]+)$/);
    if (rex3.test(aImageSrc)) {
      this._logger.debug("matched google+ profile pic");
      return aImageSrc.replace(rex3, "/photo.jpg");
    }
    
    // example photo thumb: https://lh6.googleusercontent.com/-sHGfoG3xxXX/TnlXXz7dHmI/AAXXAAAAAI8/upXXI3JTguI/w402/065.JPG
    // corresponding large image: https://lh6.googleusercontent.com/-sHGfoG3xxXX/TnlXXz7dHmI/AAXXAAAAAI8/upXXI3JTguI/065.JPG
    // the w402 field supports arbitrary width, height, and size specifications with
    // w###, h###, s###.  I've also seen a "-k" suffix.
    //
    let rex1 = new RegExp(/\/(([swh][0-9]+|-[a-z])-?)+\//);
    if (rex1.test(aImageSrc)) {
      this._logger.debug("matched google+ non-profile photo");
      return aImageSrc.replace(rex1, "/");
    }

    // example shared link thumb: https://images2-focus-opensocial.googleusercontent.com/gadgets/proxy?url=http://www.avantmusicnews.com/wp-content/themes/weaver/images/headers/sunset.jpg&container=focus&gadget=a&rewriteMime=image/*&refresh=31536000&resize_h=120&no_expand=1
    // corresponding image: http://www.avantmusicnews.com/wp-content/themes/weaver/images/headers/sunset.jpg
    let rex2 = /.*gadgets\/proxy\?url=([^&]+).*/;
    if (rex2.test(aImageSrc)) {
      // Extract the image's URL, which also needs to be url-unescaped.
      this._logger.debug("matched google+ shared URL");
      image = aImageSrc.replace(rex2, "$1");
      image = unescape(image);
      return image;
    }
    
    this._logger.debug("didn't match any google+ URL");
    return null;
  }
};

/**
 * YouTube
 */
ThumbnailZoomPlus.Pages.YouTube = {
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
ThumbnailZoomPlus.Pages.DailyMile = {
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
ThumbnailZoomPlus.Pages.IMDb = {
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
ThumbnailZoomPlus.Pages.Imgur = {
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
 * ex1:
 * http://s.photosight.ru/img/4/aef/4167500_icon.jpg
 * http://s.photosight.ru/img/4/aef/4167500_large.jpg
 * ex2:
 * http://img-1.photosight.ru/e68/4167692_top_of_day.jpg
 * http://img-1.photosight.ru/e68/4167692_large.jpg
 * ex3:
 * http://s.photosight.ru/img/5/7bd/4167881_crop_1.jpeg
 * http://s.photosight.ru/img/5/7bd/4167881_large.jpeg
 */
ThumbnailZoomPlus.Pages.Photosight = {
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

/**
 * Engadget
 */
ThumbnailZoomPlus.Pages.Engadget = {
  key: "engadget",
  name: "Engadget",
  host: /\.engadget\.[a-z]+/,
  imageRegExp: /_[0-9]+x[0-9]+\.jpe?g$/,
  getZoomImage : function(aImageSrc) {
    let rex = new RegExp(/_[0-9]+x[0-9]+(\.jpe?g)$/i);
    let image = (rex.test(aImageSrc) ? aImageSrc.replace(rex, "$1") : null);
    return image;
  }
};

/**
 * Others
 */
ThumbnailZoomPlus.Pages.Others = {
  key: "others",
  name: "Others",
  host: /.*/,
  
  // imgur.com links w/o image type suffix give page containing image.
  // Allow that; we'll add suffix in getZoomImage.  Also allow youtube links,
  // which getZoomImage will convert to a youtube thumb.
  // Note that we can't support imgur.com/a/ links (albums) since there is no
  // image named similarly to the link.
  imageRegExp: /\.gif|\.jpg|\.png|imgur\.com\/(gallery\/)?[a-zA-Z0-9]+(&.*)?$|www\.youtube\.com\/watch.*[?&]v=/,

  _logger: ThumbnailZoomPlus.Pages._logger,
  
  getSpecialSource : function(aNode, aNodeSource) {
    // we never want to use the img node.
    return null;
  },
  
  getImageNode : function(aNode, nodeName, nodeClass) {
    let imgNodeURL = null;
    if (aNode.localName.toLowerCase() == "img") {
      imgNodeURL = aNode.getAttribute("src");
    }
    // try to find an enclosing <a> (link) tag.
    while (aNode != null && aNode.localName != null && 
           aNode.localName.toLowerCase() != "a") {
      this._logger.debug("ThumbnailPreview: Others: trying parent of " + aNode);
      aNode = aNode.parentNode;
    }
    if (aNode != null) {
      if (aNode.localName == null) {
        aNode = null;
      } else if (aNode.getAttribute("href") == imgNodeURL) {
        // Don't preview the same image as we're already displaying.
        aNode = null;
      }
    }
    this._logger.debug("ThumbnailPreview: Others: returning " + aNode);

    return aNode;
  },
  
  getZoomImage : function(aImageSrc) {
    // For youtube links, change 
    // http://www.youtube.com/watch?v=-b69G6kVzTc&hd=1&t=30s to 
    // http://i3.ytimg.com/vi/-b69G6kVzTc/hqdefault.jpg
    let youtubeEx = new RegExp(/www\.youtube\.com\/watch.*[?&]v=([^&#!]+).*/);
    if (youtubeEx.test(aImageSrc)) {
        aImageSrc = aImageSrc.replace(youtubeEx, "i3.ytimg.com/vi/$1/hqdefault.jpg");
    }
    // If imgur link, remove part after "&", e.g. for https://imgur.com/nugJJ&yQU0G
    // Also turn http://imgur.com/gallery/24Av1.jpg into http://imgur.com/24Av1.jpg
    let imgurRex = new RegExp(/(imgur\.com\/)(gallery\/)?([a-zA-Z0-9]+)(&[^.]*)?/);
    aImageSrc = aImageSrc.replace(imgurRex, "$1$3");
    let rex = new RegExp(/(\.gif|\.jpg|\.png)$/);
    if (! rex.test(aImageSrc)) {
      // add .jpg, e.g. for imgur links.
      aImageSrc += ".jpg";
    }
    this._logger.debug("ThumbnailPreview: Others using zoom image " + aImageSrc);

    return aImageSrc;
  }
};
