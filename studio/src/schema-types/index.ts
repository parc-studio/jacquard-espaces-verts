// Documents - Singletons
import { aboutPageType } from './documents/singletons/about-page'
import { homePageType } from './documents/singletons/home-page'
import { projectsIndexType } from './documents/singletons/projects-index'
import { settingsType } from './documents/singletons/settings'

// Documents - Collections
import { annotationType } from './documents/collections/annotation'
import { pageType } from './documents/collections/page'
import { projectType } from './documents/collections/project'
import { tagType } from './documents/collections/tag'

// Objects
import { blockContentType } from './objects/block-content'
import { carouselSectionType } from './objects/carousel-section'
import { ctaType } from './objects/cta'
import { seoType } from './objects/seo'

// Objects - Media
import { mediaType } from './objects/media'

export const schemaTypes = [
  // Documents - Singletons
  aboutPageType,
  homePageType,
  projectsIndexType,
  settingsType,

  // Documents - Collections
  annotationType,
  pageType,
  projectType,
  tagType,

  // Objects
  seoType,
  blockContentType,
  ctaType,
  carouselSectionType,

  // Objects - Media
  mediaType,
]
