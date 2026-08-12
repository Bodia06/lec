export const CDPInput = {
  lastX: 500,
  lastY: 400,

  async attach (tabId) {
    return new Promise(resolve => {
      chrome.debugger.attach({ tabId }, '1.3', () => {
        if (chrome.runtime.lastError) {
        }
        resolve()
      })
    })
  },

  async detach (tabId) {
    return new Promise(resolve => {
      chrome.debugger.detach({ tabId }, () => {
        if (chrome.runtime.lastError) {
        }
        resolve()
      })
    })
  },

  async trustedClick (tabId, x, y) {
    await this.attach(tabId)

    const targetX = Math.round(x)
    const targetY = Math.round(y)

    const startX = this.lastX
    const startY = this.lastY

    const steps = 14
    const controlX = (startX + targetX) / 2 + (Math.random() - 0.5) * 90
    const controlY = (startY + targetY) / 2 + (Math.random() - 0.5) * 90

    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        func: () => {
          if (window.liTelemetry) window.liTelemetry.start()
        }
      })
    } catch (e) {}

    for (let i = 1; i <= steps; i++) {
      const t = i / steps
      const bezierX =
        (1 - t) * (1 - t) * startX +
        2 * (1 - t) * t * controlX +
        t * t * targetX
      const bezierY =
        (1 - t) * (1 - t) * startY +
        2 * (1 - t) * t * controlY +
        t * t * targetY

      const jitterX = i === steps ? 0 : (Math.random() - 0.5) * 3
      const jitterY = i === steps ? 0 : (Math.random() - 0.5) * 3

      const currentX = Math.round(bezierX + jitterX)
      const currentY = Math.round(bezierY + jitterY)

      await this.sendCommand(tabId, 'Input.dispatchMouseEvent', {
        type: 'mouseMoved',
        x: currentX,
        y: currentY,
        button: 'none',
        buttons: 0,
        clickCount: 0
      })

      await new Promise(r => setTimeout(r, 8 + Math.random() * 18))
    }

    this.lastX = targetX
    this.lastY = targetY

    const dwellDelay = 200 + Math.random() * 350
    await new Promise(r => setTimeout(r, dwellDelay))

    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        func: (px, py, dwell) => {
          const el = document.elementFromPoint(px, py)
          if (el) {
            el.dispatchEvent(
              new MouseEvent('mouseover', {
                bubbles: true,
                cancelable: true,
                view: window
              })
            )
            el.dispatchEvent(
              new MouseEvent('mouseenter', {
                bubbles: true,
                cancelable: true,
                view: window
              })
            )

            if (window.liTelemetry) {
              window.liTelemetry.trackMicroEvent('dwell_and_hover', el, {
                dwellTime: dwell
              })
            }
          }
        },
        args: [targetX, targetY, dwellDelay]
      })
    } catch (e) {}

    await this.sendCommand(tabId, 'Input.dispatchMouseEvent', {
      type: 'mousePressed',
      x: targetX,
      y: targetY,
      button: 'left',
      buttons: 1,
      clickCount: 1
    })

    await new Promise(r => setTimeout(r, 45 + Math.random() * 65))

    await this.sendCommand(tabId, 'Input.dispatchMouseEvent', {
      type: 'mouseReleased',
      x: targetX,
      y: targetY,
      button: 'left',
      buttons: 0,
      clickCount: 1
    })
  },

  async sendCommand (tabId, method, params) {
    return new Promise(async (resolve, reject) => {
      chrome.debugger.sendCommand({ tabId }, method, params, async result => {
        if (chrome.runtime.lastError) {
          const errMsg = chrome.runtime.lastError.message || ''
          if (
            errMsg.includes('Debugger is not attached') ||
            errMsg.includes('Another debugger')
          ) {
            try {
              await this.attach(tabId)
              chrome.debugger.sendCommand(
                { tabId },
                method,
                params,
                retryResult => {
                  if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError)
                  } else {
                    resolve(retryResult)
                  }
                }
              )
              return
            } catch (err) {
              reject(err)
              return
            }
          }
          reject(chrome.runtime.lastError)
        } else {
          resolve(result)
        }
      })
    })
  }
}
