// Documents - Singletons
import { aboutPageType } from './documents/singletons/about-page'
import { homePageType } from './documents/singletons/home-page'
import { projectsIndexType } from './documents/singletons/projects-index'
import { settingsType } from './documents/singletons/settings'

// Documents - Collections
import { annotationType } from './documents/collections/annotation'
import { expertiseType } from './documents/collections/expertise'
import { pageType } from './documents/collections/page'
import { projectType } from './documents/collections/project'
import { tagType } from './documents/collections/tag'

// Objects
import { blockContentType } from './objects/block-content'
import { carouselSectionType } from './objects/carousel-section'
import { ctaType } from './objects/cta'
import { homeSectionDoubleMediaType } from './objects/home-section-double-media'
import { homeSectionExpertiseReferenceType } from './objects/home-section-expertise-reference'
import { homeSectionMediaCarouselType } from './objects/home-section-media-carousel'
import { homeSectionMediaType } from './objects/home-section-media'
import { homeSectionProjectPairType } from './objects/home-section-project-pair'
import { homeSectionProjectReferenceType } from './objects/home-section-project-reference'
import { homeSectionTextCtaType } from './objects/home-section-text-cta'
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
  expertiseType,
  pageType,
  projectType,
  tagType,

  // Objects
  seoType,
  blockContentType,
  ctaType,
  carouselSectionType,
  homeSectionMediaType,
  homeSectionDoubleMediaType,
  homeSectionTextCtaType,
  homeSectionMediaCarouselType,
  homeSectionProjectReferenceType,
  homeSectionProjectPairType,
  homeSectionExpertiseReferenceType,

  // Objects - Media
  mediaType,
]
