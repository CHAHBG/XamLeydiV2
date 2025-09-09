import React from 'react';
import { Text } from 'react-native';
import * as IoniconsLib from '@expo/vector-icons/Ionicons';
import * as MaterialCommunityIconsLib from '@expo/vector-icons/MaterialCommunityIcons';

const resolve = (mod: any) => (mod && (mod.default ?? mod));

export const SafeIonicons: React.FC<any> = (props) => {
  try {
    const Comp = resolve(IoniconsLib);
    if (typeof Comp === 'function' || typeof Comp === 'object') {
      return React.createElement(Comp, props);
    }
  } catch (e) {
    // fallthrough
  }
  return <Text>{props.name ? String(props.name).slice(0, 1) : '·'}</Text>;
};

export const SafeMaterialCommunityIcons: React.FC<any> = (props) => {
  try {
    const Comp = resolve(MaterialCommunityIconsLib);
    if (typeof Comp === 'function' || typeof Comp === 'object') {
      return React.createElement(Comp, props);
    }
  } catch (e) {
    // fallthrough
  }
  return <Text>{props.name ? String(props.name).slice(0, 1) : '·'}</Text>;
};

export default { SafeIonicons, SafeMaterialCommunityIcons };
