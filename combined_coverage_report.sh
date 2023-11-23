#!/bin/bash

# script constants
WORK_DIR='results/combined-coverage'
COVERAGE_FILES=`find ./packages -type f -name coverage-final.json`

# cleanup before start
echo "cleaning up working directory"
rm -rf $WORK_DIR
mkdir -p $WORK_DIR

# copy all individual coverage reports
for f in ${COVERAGE_FILES[@]}; do
    cp -v "$f" $WORK_DIR/coverage-`awk -F'/' '{print $3}' <<< "$f"`.json
done

yarn nyc report -t $WORK_DIR --report-dir $WORK_DIR --reporter=html --reporter=lcov --reporter=cobertura
