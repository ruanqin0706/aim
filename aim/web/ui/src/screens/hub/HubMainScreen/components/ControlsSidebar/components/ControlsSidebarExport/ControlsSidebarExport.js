import React, { useCallback, useEffect, useState } from 'react';
import UI from '../../../../../../../ui';
import { classNames } from '../../../../../../../utils';
import './ControlsSidebarExport.less';

import PropTypes from 'prop-types';
import * as analytics from '../../../../../../../services/analytics';
import html2canvas from 'html2canvas';

function ControlsSidebarExport(props) {
  let [opened, setOpened] = useState(false);
  let [exportImgSrc, setExportImgSrc] = useState(null);
  let [processing, setProcessing] = useState(false);

  const clearLinesCircles = useCallback((svgElement) => {
    const clonedSvgElement = svgElement.cloneNode(true);
    const hoverLine = clonedSvgElement.querySelector('.HoverLine');
    const hoverCircles = clonedSvgElement.querySelectorAll('.HoverCircle');
    const lines = clonedSvgElement.querySelector('.Lines');
    if (hoverLine) {
      hoverLine.remove?.();
    }
    if (hoverCircles.length > 0) {
      hoverCircles.forEach((hoverCircle) => {
        hoverCircle.remove?.();
      });
    }
    if (lines) {
      lines.classList.remove('highlight');
    }
    return clonedSvgElement;
  }, []);

  useEffect(() => {
    if (opened) {
      const panel = document.querySelector('.Panel');
      if (panel) {
        const svgElements = panel.querySelectorAll('svg');

        if (svgElements) {
          const wrapper = document.createElement('div');
          svgElements.forEach((svgElement) => {
            // const { width, height } = svgElement.getBoundingClientRect();
            const clearedSvg = clearLinesCircles(svgElement);
            wrapper.appendChild(clearedSvg);
          });

          const body = document.getElementsByTagName('body')[0];
          body.appendChild(wrapper);
          html2canvas(wrapper).then(function (canvas) {
            const imgBase64 = canvas.toDataURL('image/png');
            console.log('imgBase64:', imgBase64);
            setExportImgSrc(imgBase64);
          });
        }
      }
    }
  }, [opened]);

  function closeModal() {
    setOpened(false);
    setExportImgSrc(null);
  }

  function toggleModal() {
    setOpened((prevState) => !prevState);
  }

  function exportImgHandler() {
    return new Promise((resolve, reject) => {
      if (exportImgSrc) {
        setProcessing(true);
      }
    });
  }

  function downloadImage(href, name) {
    let link = document.createElement('a');
    link.download = name;
    link.style.opacity = '0';
    document.body.append(link);
    link.href = href;
    link.click();
    link.remove();
  }

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
              <img src={exportImgSrc} width='100%' alt='' />
              {/*<form onSubmit={save}>*/}
              {/*  <div className='SaveAsModal__body__formInput'>*/}
              {/*    <UI.Input*/}
              {/*      onChange={(evt) => setName(evt.target.value)}*/}
              {/*      name='name'*/}
              {/*      value={name}*/}
              {/*      placeholder={'Bookmark Name'}*/}
              {/*      size='small'*/}
              {/*      autoFocus*/}
              {/*      autoComplete='off'*/}
              {/*    />*/}
              {/*  </div>*/}
              {/*  <div className='SaveAsModal__body__formInput'>*/}
              {/*    <UI.Input*/}
              {/*      onChange={(evt) => setDesc(evt.target.value)}*/}
              {/*      name='desc'*/}
              {/*      value={desc}*/}
              {/*      placeholder={'Bookmark Description'}*/}
              {/*      size='small'*/}
              {/*      autoComplete='off'*/}
              {/*    />*/}
              {/*  </div>*/}
              {/*</form>*/}
            </div>
            <div className='Modal__body__formFooter'>
              <UI.Button
                className='Modal__body__formFooter__button'
                type='primary'
                size='tiny'
                onClick={exportImgHandler}
                disabled={processing || !exportImgSrc}
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
