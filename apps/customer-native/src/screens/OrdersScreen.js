import React from 'react';
import { View, Text, FlatList } from 'react-native';
import { Card, Button, Empty, useTheme, satoshi, REPEAT_CADENCE, nextRepeatDue } from '@chaselaundry/shared-native';
import OrderRow from '../components/OrderRow';

export default function OrdersScreen({ orders, onOpenOrder, onOrder }) {
  const t = useTheme();
  const due = orders[0] && nextRepeatDue(orders[0]);
  const dueNow = due && due <= new Date();

  return (
    <View style={{ flex: 1, backgroundColor: t.light }}>
      <FlatList
        data={orders}
        keyExtractor={(o) => o.id}
        contentContainerStyle={{ padding: 18 }}
        ListHeaderComponent={
          <>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <Text style={{ fontSize: 22, fontFamily: satoshi(900) }}>Your orders</Text>
              <Button sm variant="lime" onPress={onOrder}>+ New</Button>
            </View>
            {dueNow && (
              <Card onPress={onOrder} style={{ marginBottom: 14, backgroundColor: t.navy }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: satoshi(800), color: '#fff' }}>
                      🔁 Time for your {(REPEAT_CADENCE[orders[0].repeat_cadence]?.label || 'repeat').toLowerCase()} order
                    </Text>
                    <Text style={{ fontSize: 12, color: 'rgba(255,255,255,.6)', marginTop: 2 }}>Same as last time — schedule your next pickup?</Text>
                  </View>
                  <Button sm variant="lime" onPress={onOrder}>Schedule</Button>
                </View>
              </Card>
            )}
          </>
        }
        ListEmptyComponent={<Empty icon="📦" title="No orders yet" sub="Book your first pickup to get started" />}
        renderItem={({ item }) => <OrderRow o={item} onPress={() => onOpenOrder(item.id)} />}
      />
    </View>
  );
}
