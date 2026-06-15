"use client";

import jsVectorMap from "jsvectormap";
import { useEffect } from "react";

import 'jsvectormap/dist/jsvectormap.min.css'
import 'jsvectormap/dist/maps/world'

// import "@/js/us-aea-en";

// Import the Europe map
// import "jsvectormap/dist/maps/world/europe.js";
// import "jsvectormap/dist/css/jsvectormap.css";

export default function Map() {
  useEffect(() => {
    new jsVectorMap({
      selector: "#mapOne",
      map: "world",
      // map: "europe",
      // map: "us_aea_en",
      zoomButtons: true,
      selectedRegions: ['NL', 'UK'],
      regionStyle: {
        initial: {
          fill: "#C8D0D8",
        },
        hover: {
          fillOpacity: 1,
          fill: "#3056D3",
        },
      },

      regionLabelStyle: {
        initial: {
          fontWeight: "semibold",
          fill: "#fff",
        },
        hover: {
          cursor: "pointer",
        },
      },
      labels: {
        regions: {
          render(code: string) {
            return code.split("-")[1];
          },
        },
      },
    });
  }, []);

  return (
    <div className="h-auto">
      <div id="mapOne" />
    </div>
  );
}
