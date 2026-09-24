import React, { memo, forwardRef, useState, useEffect } from "react";
import { LiquidMetal as LiquidMetalShader } from "@paper-design/shaders-react";
import { cn } from "@/lib/utils";

// ============================================================================
// LiquidMetal - Base shader wrapper with fallback resiliency
// ============================================================================

export const LiquidMetal = memo(function LiquidMetal({
  colorBack = "#888890",
  colorTint = "#ffffff",
  speed = 0.6,
  repetition = 4,
  distortion = 0.18,
  scale = 1,
  className,
  style,
}) {
  const [hasError, setHasError] = useState(false);

  // If WebGL fails or context is lost, render high-fidelity CSS liquid chrome stream
  if (hasError) {
    return (
      <div
        className={cn(
          "absolute inset-0 z-0 overflow-hidden pointer-events-none liquid-metal-css-fallback",
          className
        )}
        style={style}
      />
    );
  }

  return (
    <div
      className={cn("absolute inset-0 z-0 overflow-hidden pointer-events-none", className)}
      style={style}
    >
      <LiquidMetalErrorBoundary onError={() => setHasError(true)}>
        <LiquidMetalShader
          colorBack={colorBack}
          colorTint={colorTint}
          speed={speed}
          repetition={repetition}
          distortion={distortion}
          softness={0}
          shiftRed={0.3}
          shiftBlue={-0.3}
          angle={45}
          shape="none"
          scale={scale}
          fit="cover"
          style={{ width: "100%", height: "100%" }}
        />
      </LiquidMetalErrorBoundary>
    </div>
  );
});

LiquidMetal.displayName = "LiquidMetal";

// Safe error boundary for WebGL shaders
class LiquidMetalErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    console.debug("LiquidMetal shader fallback triggered:", error);
    if (this.props.onError) this.props.onError();
  }

  render() {
    if (this.state.hasError) {
      return <div className="absolute inset-0 z-0 overflow-hidden liquid-metal-css-fallback" />;
    }
    return this.props.children;
  }
}

// ============================================================================
// LiquidMetalBorder - Universal container for Cards, Tiles, and Nav items
// Slightly thicker than normal (default: 5px) with liquid metal fluid flow
// ============================================================================

export const LiquidMetalBorder = forwardRef(function LiquidMetalBorder(
  {
    children,
    borderWidth = 5, // Slightly thicker than normal as requested (default: 5px)
    borderRadius = "rounded-[2.5rem]",
    className = "",
    innerClassName = "",
    metalConfig,
    glow = true,
    style,
    ...props
  },
  ref
) {
  return (
    <div
      ref={ref}
      className={cn(
        "relative group transition-all duration-300",
        borderRadius,
        glow && "shadow-[0_20px_60px_-15px_rgba(255,255,255,0.08)] hover:shadow-[0_25px_80px_-10px_rgba(255,255,255,0.18)]",
        className
      )}
      style={{
        padding: `${borderWidth}px`,
        ...style,
      }}
      {...props}
    >
      {/* Outer Liquid Metal Flowing Border Layer */}
      <LiquidMetal
        colorBack={metalConfig?.colorBack ?? "#707078"}
        colorTint={metalConfig?.colorTint ?? "#ffffff"}
        speed={metalConfig?.speed ?? 0.5}
        repetition={metalConfig?.repetition ?? 4}
        distortion={metalConfig?.distortion ?? 0.16}
        scale={metalConfig?.scale ?? 1}
        className={cn("absolute inset-0 z-0", borderRadius)}
      />

      {/* Subtle fluid reflection sheen */}
      <div
        className={cn(
          "pointer-events-none absolute inset-0 z-[1] opacity-60 mix-blend-overlay",
          borderRadius
        )}
        style={{
          background:
            "linear-gradient(135deg, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0.05) 50%, rgba(200,220,255,0.3) 100%)",
        }}
      />

      {/* Inner Card/Tile Body */}
      <div
        className={cn(
          "relative z-10 h-full w-full overflow-hidden",
          borderRadius,
          innerClassName
        )}
      >
        {children}
      </div>
    </div>
  );
});

LiquidMetalBorder.displayName = "LiquidMetalBorder";

// ============================================================================
// LiquidMetalButton - Premium button with thick liquid metal flowing border
// ============================================================================

export const LiquidMetalButton = forwardRef(function LiquidMetalButton(
  {
    children,
    icon,
    borderWidth = 4, // Slightly thicker than normal (4px)
    borderRadius = "rounded-full",
    metalConfig,
    size = "md",
    className = "",
    innerClassName = "",
    disabled,
    onClick,
    type = "button",
    ...props
  },
  ref
) {
  const sizeStyles = {
    sm: "py-2 px-4 gap-2 text-sm",
    md: "py-3 px-6 gap-3 text-base",
    lg: "py-4 px-8 gap-4 text-lg",
  };

  const iconSizes = {
    sm: "w-6 h-6",
    md: "w-8 h-8",
    lg: "w-10 h-10",
  };

  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "relative group inline-flex cursor-pointer border-none bg-transparent p-0 outline-none transition-transform active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none",
        borderRadius,
        className
      )}
      {...props}
    >
      <div
        className={cn(
          "relative w-full overflow-hidden transition-all duration-300 shadow-[0_15px_40px_-10px_rgba(255,255,255,0.12)] group-hover:shadow-[0_20px_50px_-5px_rgba(255,255,255,0.22)]",
          borderRadius
        )}
        style={{ padding: `${borderWidth}px` }}
      >
        {/* Liquid Metal Border Layer */}
        <LiquidMetal
          colorBack={metalConfig?.colorBack ?? "#888890"}
          colorTint={metalConfig?.colorTint ?? "#ffffff"}
          speed={metalConfig?.speed ?? 0.6}
          repetition={metalConfig?.repetition ?? 4}
          distortion={metalConfig?.distortion ?? 0.18}
          scale={metalConfig?.scale ?? 1}
          className={cn("absolute inset-0 z-0", borderRadius)}
        />

        {/* Inner Button Body */}
        <div
          className={cn(
            "relative z-10 flex items-center justify-center font-semibold tracking-tight transition-colors duration-200",
            "bg-black text-white group-hover:bg-neutral-900/90",
            borderRadius,
            sizeStyles[size],
            innerClassName
          )}
        >
          {icon && (
            <div
              className={cn(
                "rounded-full flex items-center justify-center bg-white/10 text-white shadow-[inset_0_2px_4px_rgba(0,0,0,0.2)]",
                iconSizes[size]
              )}
            >
              {icon}
            </div>
          )}
          <span>{children}</span>
        </div>
      </div>
    </button>
  );
});

LiquidMetalButton.displayName = "LiquidMetalButton";

export default LiquidMetalBorder;
