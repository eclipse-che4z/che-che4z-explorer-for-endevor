## Explorer for Endevor Views

Explorer for Endevor offers two views through which you can inspect Endevor:
- Filter View

    Filter View contains all filters created based on your previous work in the Map View. Filters are shown from the highest level first, with any subsequent related filters showing as a drop-down option
- Map View

    Map View expands to show the several levels of Endevor data. You can navigate the Map View with no prior knowledge of the contents, with all potential options shown along with their subsequent sub-levels
    
### Explorer for Endevor Filter View

Filter View contains all filters created based on your previous work in the Map View. Filters are shown from the highest level first, with any subsequent related filters showing as a drop-down option.
Navigate through the final two levels using the following methods:
- Specifying the exact Type and Element
- Using wildcards, for example:
  - The top-level Filter is shown with the last two fields, Type and Element, as wildcards ( * ).
  - The subsequent level shows the Type field as being specified, with only the Element field as a wildcard.
  - The final level shows the Element level. This level contains only the elements that are reached by the specific path. As such no wildcards are used here.

Example:
- ENV1/1/QAPKG/SBSQAPKG/ * / *
  - ENV1/1/QAPKG/SBSQAPKG/PROCESS/ *
    - ENV1/1/QAPKG/SBSQAPKG/PROCESS/DELPROC
    - ENV1/1/QAPKG/SBSQAPKG/PROCESS/GENPROC
    - ENV1/1/QAPKG/SBSQAPKG/PROCESS/MOVPROC
