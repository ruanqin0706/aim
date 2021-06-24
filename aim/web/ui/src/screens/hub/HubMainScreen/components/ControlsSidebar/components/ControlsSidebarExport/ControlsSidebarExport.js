import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import UI from '../../../../../../../ui';
import { classNames } from '../../../../../../../utils';
import './ControlsSidebarExport.less';

import PropTypes from 'prop-types';
import html2canvas from 'html2canvas';
import * as analytics from '../../../../../../../services/analytics';

import { Instagram as ContentLoader } from 'react-content-loader';
import moment from 'moment';

function ControlsSidebarExport(props) {
  const [opened, setOpened] = useState(false);
  const [exportImgCanvas, setExportImgCanvas] = useState(null);
  const [exportImgMimeType, setExportImgMimeType] = useState('jpeg');
  const [processing, setProcessing] = useState(false);

  const imgBase64Src = useRef('');
  const wrapper = useRef(null);
  const timeOutId = useRef(null);

  function closeModal() {
    window.clearTimeout(timeOutId.current);
    imgBase64Src.current = '';
    wrapper.current?.remove();
    setOpened(false);
    setExportImgCanvas(null);
  }

  async function setImg() {
    try {
      const canvas = await html2canvas(wrapper.current);
      imgBase64Src.current = canvas.toDataURL(
        `image/${exportImgMimeType}`,
        1.0,
      );
      setExportImgCanvas(canvas);
    } catch (err) {
      console.error(err);
    } finally {
      setProcessing(false);
    }
  }

  const clearImage = useCallback((element) => {
    const clonedElement = element.cloneNode(true);
    const hoverLine = clonedElement.querySelector('.HoverLine');
    const circles = clonedElement.getElementsByTagName('circle');
    const lines = clonedElement.querySelector('.Lines');
    if (hoverLine) {
      hoverLine.remove?.();
    }
    if (circles?.length > 0) {
      Array.from(circles).forEach((circle) => {
        circle.remove?.();
      });
    }
    if (lines) {
      lines.classList.remove('highlight');
    }
    return clonedElement;
  }, []);

  const loadImg = useCallback(() => {
    const panel = document.querySelector('.Panel');
    if (panel) {
      setProcessing(true);
      const svgElements = panel.querySelectorAll('svg');
      wrapper.current = document.createElement('div');
      svgElements?.forEach((svgElement) => {
        const clearedSvgElement = clearImage(svgElement);
        wrapper.current.appendChild(clearedSvgElement);
      });

      const root = document.getElementById('root');
      wrapper.current.style.position = 'fixed';
      wrapper.current.style.zIndex = '-1';
      wrapper.current.style.background = 'white';
      wrapper.current.style.display = 'inline-flex';
      wrapper.current.style.flexWrap = 'wrap';
      wrapper.current.style.width = `${panel.offsetWidth + 10}px`;
      wrapper.current.style.height = `${panel.offsetHeight + 10}px`;
      root.appendChild(wrapper.current);

      window.clearTimeout(timeOutId.current);
      timeOutId.current = window.setTimeout(setImg);
    }
  }, [clearImage, setImg, setProcessing]);

  const toggleModal = useCallback(() => {
    setOpened((prevOpened) => {
      if (prevOpened) {
        closeModal();
      }
      return !prevOpened;
    });
  }, [closeModal]);

  const downloadBase64File = useCallback((base64Data, fileName) => {
    const downloadLink = document.createElement('a');
    downloadLink.href = base64Data;
    downloadLink.download = fileName;
    downloadLink.click();
  }, []);

  const exportImgHandler = useCallback(
    (imgCanvas, imgMimeType) => () => {
      if (imgCanvas && imgMimeType) {
        imgBase64Src.current = imgCanvas.toDataURL(`image/${imgMimeType}`, 1.0);
        const filename = `chart-${moment().format(
          'HH:mm:ss · D MMM, YY',
        )}.${imgMimeType}`;
        downloadBase64File(imgBase64Src.current, filename);
        analytics.trackEvent('[Explore] Export chart image');
      }
    },
    [downloadBase64File],
  );

  useEffect(() => {
    if (opened) {
      loadImg();
    }
  }, [opened]);

  return (
    <>
      <UI.Tooltip
        tooltip={props.disabled ? 'Export is disabled' : 'Export panel'}
      >
        <div
          className={classNames({
            ControlsSidebar__item: true,
            disabled: props.disabled,
          })}
          onClick={toggleModal}
        >
          <UI.Icon i='get_app' scale={1.7} />
        </div>
      </UI.Tooltip>
      <div
        className={classNames({
          Modal__backdrop: true,
          opened,
        })}
        onClick={closeModal}
      />
      <div
        className={classNames({
          Modal: true,
          opened,
        })}
      >
        {opened && (
          <>
            <div className='Modal__header'>
              <UI.Text overline bold>
                Export Chart
              </UI.Text>
            </div>
            <div className='Modal__body'>
              {processing ? (
                <ContentLoader
                  width={100}
                  height={'250px'}
                  viewBox='0 0 400 200'
                  style={{ width: '100%' }}
                />
              ) : (
                <img
                  src={imgBase64Src.current}
                  width='100%'
                  height='250px'
                  alt='exported image'
                  style={{ objectFit: 'contain' }}
                />
              )}
            </div>
            <div className='Modal__body__formFooter'>
              <UI.Dropdown
                width={150}
                options={['jpeg', 'png'].map((val) => ({
                  value: val,
                  label: `${val.toUpperCase()}`,
                }))}
                defaultValue={{
                  value: exportImgMimeType,
                  label: `${exportImgMimeType.toUpperCase()}`,
                }}
                onChange={(option) => setExportImgMimeType(option.value)}
              />
              <UI.Button
                className='Modal__body__formFooter__button'
                type='primary'
                size='tiny'
                style={{ marginLeft: 'auto' }}
                onClick={exportImgHandler(exportImgCanvas, exportImgMimeType)}
                disabled={processing || !imgBase64Src.current}
              >
                Export
              </UI.Button>
              <UI.Button
                className='Modal__body__formFooter__button'
                type='secondary'
                size='tiny'
                onClick={closeModal}
              >
                Cancel
              </UI.Button>
            </div>
          </>
        )}
      </div>
    </>
  );
}

ControlsSidebarExport.propTypes = {
  disabled: PropTypes.bool,
};

export default React.memo(ControlsSidebarExport);
