import { requestType, _HTMLImageElement as _Image } from '../../utils/types'
import { Filter } from './Filter'

const notEmpty = <T>(value: T | null | undefined): value is T => {
  return value !== null && value !== undefined
}

export type IImageFilter = {
  analyzeImage: (image: _Image) => void
  analyzeDiv: (div: _Image) => void
}

export class ImageFilter extends Filter implements IImageFilter {
  public analyzeImage (image: _Image): void {
    // Skip small images, but pass pending
    if ((image.width > 32 && image.height > 32) || image.width === 0 || image.height === 0) {
      if (image._isChecked === undefined && image.src.length > 0) {
        image._isChecked = true
        image.style.visibility = 'hidden'

        this.logger.log(`Analyze image ${image.src}`)
        this._analyzeImage(image).then(() => {}, () => {})
      }
    }
  }

  public async analyzeDiv (div: _Image): Promise<void> {
    if (div._isChecked === undefined && typeof div.style.backgroundImage === 'string' && div.style.backgroundImage.length > 0) {
      div._isChecked = true
      div.style.visibility = 'hidden'

      const url: string | undefined = ImageFilter.prepareUrl(div.style.backgroundImage.slice(5, -2))
      if (url === undefined) return

      const result = await this.requestToAnalyzeImage({ url })
      if (result) {
        this.blockedItems++
        return
      }

      div.style.visibility = 'visible'
    }
  }

  private async _analyzeImage (image: _Image): Promise<void> {
    // For google images case, where raw image has invalid url with slashes
    if (Array.isArray(image.src.match(/\/\/\/\/\//))) {
      this.handleInvalidRawDate(image)
      return
    }

    const request: requestType = ImageFilter.buildRequest(image)
    const result = await this.requestToAnalyzeImage(request)

    if (result) {
      this.blockedItems++
      return
    }

    image.style.visibility = 'visible'
  }

  private handleInvalidRawDate (image: _Image): void {
    image._fullRawImageCounter = image._fullRawImageCounter ?? 0
    this.logger.log(`Invalid raw image ${image.src}, attempt ${image._fullRawImageCounter}`)
    image._fullRawImageCounter++
    clearTimeout(image._fullRawImageTimer)

    if (image._fullRawImageCounter < 77) {
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      image._fullRawImageTimer = window.setTimeout(async () => await this._analyzeImage(image), 100)
      return
    }

    image.style.visibility = 'visible'
    this.logger.log(`Invalid raw image, marked as visible ${image.src}`)
  }

  private static buildRequest (image: _Image): requestType {
    const message: requestType = { url: image.src }

    if (Object.values(image.dataset).length > 0) {
      message.lazyUrls = Object.values(image.dataset).map(url => {
        if (typeof url === 'string') return ImageFilter.prepareUrl(url)
      }).filter(notEmpty)
    }

    return message
  }
}