import ScreenWrapper from '@/src/components/layout/ScreenWrapper'
import Typo from '@/src/components/ui/Typo'
import { useAuth } from '@/src/contexts/authContext'
import * as React from 'react'
import { StyleSheet } from 'react-native'

const Home = () => {
  const {user} = useAuth();
  return (
    <ScreenWrapper>
      <Typo>Home</Typo>
    </ScreenWrapper>
  )
}

export default Home

const styles = StyleSheet.create({})