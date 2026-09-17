import React, { useEffect, useRef, useState, useMemo } from 'react';
import { FlatList, View, Text, StyleSheet, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';

type TimeWheelPickerProps = {
  value: number; // 0-1439
  onChange: (minutes: number) => void;
};

const ITEM_HEIGHT = 48;
const PADDING = 0;
const LOOP_MULTIPLIER = 1000;

type WheelPickerProps = {
  data: string[];
  selectedIndex: number;
  onChange: (index: number) => void;
  width?: number;
};

function WheelPicker({ data, selectedIndex, onChange, width = 60 }: WheelPickerProps) {
  const flatListRef = useRef<FlatList>(null);
  
  const middleOffset = Math.floor(LOOP_MULTIPLIER / 2) * data.length;
  const [internalIndex, setInternalIndex] = useState(selectedIndex + middleOffset);
  
  const loopedData = useMemo(() => {
    const arr = new Array(data.length * LOOP_MULTIPLIER);
    for (let i = 0; i < arr.length; i++) {
      arr[i] = data[i % data.length];
    }
    return arr;
  }, [data]);

  useEffect(() => {
    setInternalIndex((prev) => {
      const currentMod = prev % data.length;
      if (currentMod === selectedIndex) return prev;
      
      const currentBase = prev - currentMod;
      const targetIndex = currentBase + selectedIndex;
      
      setTimeout(() => {
        flatListRef.current?.scrollToOffset({
          offset: targetIndex * ITEM_HEIGHT,
          animated: true,
        });
      }, 0);
      
      return targetIndex;
    });
  }, [selectedIndex, data.length]);

  const onMomentumScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetY = e.nativeEvent.contentOffset.y;
    let index = Math.round(offsetY / ITEM_HEIGHT);
    index = Math.max(0, Math.min(index, loopedData.length - 1));
    
    // Silent recentering near physical edges
    if (index < 100 || index > loopedData.length - 100) {
      const normalizedMod = index % data.length;
      index = middleOffset + normalizedMod;
      flatListRef.current?.scrollToOffset({
        offset: index * ITEM_HEIGHT,
        animated: false,
      });
    }

    setInternalIndex(index);
    onChange(index % data.length);
  };

  return (
    <View style={[styles.wheelContainer, { width }]}>
      <FlatList
        ref={flatListRef}
        data={loopedData}
        keyExtractor={(_, idx) => idx.toString()}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="fast"
        getItemLayout={(_, index) => ({
          length: ITEM_HEIGHT,
          offset: ITEM_HEIGHT * index,
          index,
        })}
        onMomentumScrollEnd={onMomentumScrollEnd}
        contentContainerStyle={{
          paddingTop: PADDING,
          paddingBottom: PADDING,
        }}
        initialScrollIndex={internalIndex}
        renderItem={({ item }) => (
          <View style={styles.itemContainer}>
            <Text style={styles.itemTextSelected}>
              {item}
            </Text>
          </View>
        )}
      />
    </View>
  );
}

export function TimeWheelPicker({ value, onChange }: TimeWheelPickerProps) {
  const hoursData = Array.from({ length: 12 }, (_, i) => (i + 1).toString());
  const minutesData = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0'));
  const periodsData = ['AM', 'PM'];

  const parsed = useMemo(() => {
    let h = Math.floor(value / 60);
    const m = value % 60;
    let p = 0; // AM
    if (h >= 12) {
      p = 1; // PM
      if (h > 12) h -= 12;
    } else if (h === 0) {
      h = 12;
    }
    return { hIndex: h - 1, mIndex: m, pIndex: p };
  }, [value]);

  const handleIndexChange = (type: 'h' | 'm' | 'p', newIdx: number) => {
    let { hIndex, mIndex, pIndex } = parsed;
    if (type === 'h') hIndex = newIdx;
    if (type === 'm') mIndex = newIdx;
    if (type === 'p') pIndex = newIdx;

    let h = hIndex + 1;
    const m = mIndex;
    const isPM = pIndex === 1;

    if (isPM && h < 12) h += 12;
    if (!isPM && h === 12) h = 0;

    const newMins = h * 60 + m;
    if (newMins !== value) {
      onChange(newMins);
    }
  };

  return (
    <View style={styles.pickerContainer}>
      <WheelPicker data={hoursData} selectedIndex={parsed.hIndex} onChange={(i) => handleIndexChange('h', i)} />
      <Text style={styles.colon}>:</Text>
      <WheelPicker data={minutesData} selectedIndex={parsed.mIndex} onChange={(i) => handleIndexChange('m', i)} />
      <View style={styles.spacer} />
      <WheelPicker data={periodsData} selectedIndex={parsed.pIndex} onChange={(i) => handleIndexChange('p', i)} width={60} />
    </View>
  );
}

const styles = StyleSheet.create({
  pickerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E2228',
    borderRadius: 8,
    height: 48,
  },
  wheelContainer: {
    height: ITEM_HEIGHT,
    alignItems: 'center',
  },
  itemContainer: {
    height: ITEM_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemTextSelected: {
    fontSize: 20,
    fontWeight: '700',
    color: '#E8E9EC',
  },
  colon: {
    fontSize: 20,
    fontWeight: '700',
    color: '#737983',
    marginHorizontal: 0,
  },
  spacer: {
    width: 8,
  }
});
