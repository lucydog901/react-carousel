import React, { useRef, useCallback, useEffect } from 'react';
import { useRecoilState, useSetRecoilState } from 'recoil';
import { withResizeDetector } from 'react-resize-detector';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import _compact from 'lodash/compact';

// config
import config from '../constants/config';
// hooks
import useEventListener from '../hooks/useEventListener';
import useOnResize from '../hooks/useOnResize';
// tools
import simulateEvent from '../tools/simulateEvent';
import getChildren from '../tools/getChildren';
import carouselPluginResolver from '../tools/carouselPluginResolver';
import {
  activeSlideIndexState,
  slideOffsetState,
  slideWidthState,
  slidesState,
} from '../state/atoms/slideAtoms';
import {
  carouselStrategiesState,
  trackStylesState,
  trackWidthState,
  transitionEnabledState,
  slideMovementState,
} from '../state/atoms/carouselAtoms';

import CarouselItem from './CarouselItem';

import '../styles/Carousel.scss';

const Carousel = (props) => {
  const [slideMovement, setSlideMovement] = useRecoilState(slideMovementState);
  const [itemWidth, setItemWidth] = useRecoilState(slideWidthState);
  const setItemOffset = useSetRecoilState(slideOffsetState);
  const [trackWidth, setTrackWidth] = useRecoilState(trackWidthState);
  const [activeSlideIndex] = useRecoilState(activeSlideIndexState);
  const [transitionEnabled, setTransitionEnabled] = useRecoilState(
    transitionEnabledState,
  );
  const [trackStyles, setTrackStyles] = useRecoilState(trackStylesState);
  const children = getChildren(props.children, props.slides);
  const [slides, setSlides] = useRecoilState(slidesState);
  const setStrategies = useSetRecoilState(carouselStrategiesState);

  const isInitialMount = useRef(true);
  const carouselRef = useRef(null);
  const trackContainerRef = useRef(null);

  const {
    carouselPlugins,
    itemClassNames,
    carouselClassNames,
    beforeCarouselItems,
    afterCarouselItems,
    strategies,
    carouselCustomProps,
  } = carouselPluginResolver(
    props.plugins,
    props,
    trackContainerRef,
    carouselRef,
  );

  setStrategies(strategies);

  /**
   * Function handling mouse move if drag has started. Sets dragOffset in the state.
   * @param {event} e event
   */
  const onMouseMove = useCallback(
    (e) => {
      if (slideMovement.dragStart !== 0) {
        const { pageX } = e;

        setTransitionEnabled(false);

        setSlideMovement((previousState) => ({
          ...slideMovement,
          dragOffset: pageX - previousState.dragStart,
          dragEnd: pageX,
        }));

        setTransitionEnabled(true);
      }
    },
    [slideMovement, setTransitionEnabled],
  );

  /**
   * Function handling beginning of mouse drag by setting index of clicked item and coordinates of click in the state
   * @param {event} e event
   * @param {number} index of the element drag started on
   */
  const onMouseDown = useCallback(
    (e, index) => {
      e.preventDefault();
      e.stopPropagation();
      const { pageX } = e;

      setSlideMovement({
        ...slideMovement,
        clicked: index,
        dragStart: pageX,
      });
    },
    [slideMovement, setTransitionEnabled],
  );

  /**
   * Function handling beginning of touch drag by setting index of touched item and coordinates of touch in the state
   * @param {event} e event
   * @param {number} index of the element drag started on
   */
  const onTouchStart = useCallback((e, index) => {
    const { changedTouches } = e;
    setSlideMovement({
      clicked: index,
      dragStart: changedTouches[0].pageX,
    });
  }, []);

  /**
   * Function handling end of touch or mouse drag. If drag was long it changes current slide to the nearest one,
   * if drag was short (or it was just a click) it changes slide to the clicked (or touched) one.
   * It resets clicked index, dragOffset and dragStart values in state.
   * @param {event} e event
   */
  const onMouseUpTouchEnd = useCallback(
    (e) => {
      if (slideMovement.dragStart !== 0) {
        e.preventDefault();
        if (props.draggable) {
          setTransitionEnabled(true);
          props.onChange(props.nearestSlideIndex);
        }
        setSlideMovement({
          clicked: null,
          dragOffset: 0,
          dragStart: 0,
        });
      }
    },
    [slideMovement],
  );

  useOnResize({
    carouselRef,
    itemWidth,
    setItemWidth,
    trackContainerRef,
    width: props.width,
  });

  useEffect(() => {
    setSlides(children);
  }, []);

  useEffect(() => {
    setItemOffset(props.offset);
  }, [props.offset]);

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
    } else {
      setTransitionEnabled(true);
    }
  }, [props.value]);

  useEffect(() => {
    const trackWidth =
      trackContainerRef?.current?.offsetWidth * children.length;

    setTrackWidth(trackWidth);
  }, [trackContainerRef?.current?.offsetWidth]);

  useEffect(() => {
    setTrackStyles({
      ...trackStyles,
      transform: props.transformOffset,
    });
  }, [props.transformOffset]);

  useEventListener('mouseup', onMouseUpTouchEnd);

  useEventListener('mousemove', onMouseMove, carouselRef.current);
  useEventListener('touchstart', simulateEvent, carouselRef.current);
  useEventListener('touchmove', simulateEvent, carouselRef.current);
  useEventListener('touchend', simulateEvent, carouselRef.current);

  carouselPlugins?.forEach((plugin) =>
    typeof plugin === 'function' ? plugin() : plugin.plugin && plugin.plugin(),
  );

  /* ========== rendering ========== */
  const renderCarouselItems = () => {
    const animationSpeed = props.animationSpeed;
    const draggable = props.draggable && children && children.length > 1;

    const currentTrackStyles = {
      width: `${trackWidth}px`,
      transitionDuration: transitionEnabled
        ? `${animationSpeed}ms, ${animationSpeed}ms`
        : null,
      transform: `translateX(${trackStyles.transform}px)`,
      marginLeft: `${trackStyles.marginLeft}px`,
      marginRight: `${trackStyles.marginRight}px`,
    };

    return (
      <div className="BrainhubCarousel__trackContainer" ref={trackContainerRef}>
        <ul
          className={classnames('BrainhubCarousel__track', {
            'BrainhubCarousel__track--transition': transitionEnabled,
            'BrainhubCarousel__track--draggable': draggable,
          })}
          style={currentTrackStyles}
          {...carouselCustomProps}
        >
          {_compact(slides).map((carouselItem, index) => (
            <CarouselItem
              clickable
              key={index}
              currentSlideIndex={activeSlideIndex || props.value}
              index={index}
              width={props.itemWidth || itemWidth}
              offset={index !== slides.length ? props.offset : 0}
              onMouseDown={onMouseDown}
              onTouchStart={onTouchStart}
              isDragging={
                Math.abs(slideMovement.dragOffset) > config.clickDragThreshold
              }
              itemClassNames={itemClassNames}
              isDraggingEnabled={props.draggable}
            >
              {carouselItem}
            </CarouselItem>
          ))}
        </ul>
      </div>
    );
  };

  return (
    <div className="BrainhubCarousel__container">
      <div
        className={classnames(
          'BrainhubCarousel',
          props.className,
          ...(carouselClassNames || []),
        )}
        ref={carouselRef}
      >
        {React.createElement(React.Fragment, null, beforeCarouselItems)}
        {renderCarouselItems()}
        {React.createElement(React.Fragment, null, afterCarouselItems)}
      </div>
    </div>
  );
};

Carousel.propTypes = {
  itemWidth: PropTypes.number,
  width: PropTypes.number,
  value: PropTypes.number,
  onChange: PropTypes.func,
  children: PropTypes.node,
  slides: PropTypes.arrayOf(PropTypes.node),
  offset: PropTypes.number,
  draggable: PropTypes.bool,
  animationSpeed: PropTypes.number,
  className: PropTypes.string,
  transformOffset: PropTypes.number,
  nearestSlideIndex: PropTypes.number,
  plugins: PropTypes.arrayOf(
    PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.func,
      PropTypes.shape({
        resolve: PropTypes.func,
        options: PropTypes.object, // eslint-disable-line react/forbid-prop-types
      }),
    ]),
  ),
  breakpoints: PropTypes.objectOf(
    PropTypes.shape({
      slidesPerPage: PropTypes.number,
      draggable: PropTypes.bool,
      animationSpeed: PropTypes.number,
      dots: PropTypes.bool,
      className: PropTypes.string,
      transformOffset: PropTypes.string,
    }),
  ),
};
Carousel.defaultProps = {
  slidesPerPage: 1,
  offset: 0,
  animationSpeed: 500,
  draggable: true,
  plugins: [],
};

export default withResizeDetector(React.memo(Carousel));
